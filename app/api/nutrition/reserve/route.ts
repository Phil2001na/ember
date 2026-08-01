import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { brain, spareBrain } from "@/lib/ai";
import { createMachineClient } from "@/lib/supabase/machine";
import { RecipeSchema } from "@/lib/schemas";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

/**
 * Fitness → Ember, V4 (machine-to-machine): reserve — see docs/integrations/fitness-v4.md.
 *
 * Same trust class as /api/nutrition/suggest (shared secret header, same
 * pantry-read RPC) but told exactly which dish to write instead of asked to
 * pick one, and the result is persisted so `/from/fitness?recipe_id=...` can
 * open it later without generating anything fresh.
 */

const ReservedDishSchema = RecipeSchema.extend({
  kcal_estimate: z.number().int().min(50).max(2000).describe("Pantry-accurate calories for one serving"),
  protein_g_estimate: z.number().int().min(0).max(150).describe("Pantry-accurate protein in grams"),
  needs_cooking: z.boolean(),
  why: z.string().describe("Half a sentence on why this fits what they need right now"),
});

type PantryItem = { item: string; qty: string | null };

export async function POST(request: Request) {
  const secret = request.headers.get("x-integration-secret") ?? "";
  const expected = process.env.FITNESS_INTEGRATION_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const emberUserId = body?.ember_user_id;
  if (!emberUserId || typeof emberUserId !== "string") {
    return NextResponse.json({ error: "missing-user" }, { status: 400 });
  }

  const dish = typeof body?.dish === "string" ? body.dish.trim().slice(0, 200) : "";
  if (!dish) {
    return NextResponse.json({ error: "missing-dish" }, { status: 400 });
  }

  const kcal = Math.min(3000, Math.max(50, Number(body?.kcal_target) || 600));
  const proteinTarget = Math.min(300, Math.max(0, Number(body?.protein_target_g) || 0));
  const timeMinutes = Math.min(180, Math.max(5, Number(body?.time_minutes) || 30));
  const slot = String(body?.slot ?? "meal").replace(/_/g, " ");

  const supabase = createMachineClient();
  const { data, error } = await supabase.rpc("ember_pantry_for_integration", {
    p_secret: expected,
    p_user_id: emberUserId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pantry = (data?.pantry ?? []) as PantryItem[];
  const equipment = (data?.equipment ?? []) as string[];
  const skill = data?.profile?.skill_level ?? "comfortable";
  const dietary = data?.profile?.dietary_notes ?? null;

  // Unlike /api/nutrition/suggest, an empty pantry here isn't a soft "no
  // suggestions" — it would mean writing a recipe with nothing real behind
  // it. Fitness treats any non-200 as "reservation failed" and just saves
  // the plan without a recipe reference, which is the right outcome here.
  if (!pantry.length) {
    return NextResponse.json({ error: "empty-pantry" }, { status: 422 });
  }

  const hasScale = equipment.some((e) => /scale/i.test(e));

  const prompt = `You are Ember, writing the exact recipe for a dish someone already decided on.

THEIR PANTRY:
${pantry.map((p) => `- ${p.item}${p.qty ? ` (${p.qty})` : ""}`).join("\n")}

EQUIPMENT: ${equipment.length ? equipment.join(", ") : "basic stovetop only"}
SKILL: ${skill}${dietary ? `\nDIETARY NOTES: ${dietary}` : ""}

THE DISH (already decided — write exactly this, do not substitute a different dish): "${dish}"

TARGET: this is ${slot}, aiming for about ${kcal} kcal${proteinTarget ? ` and roughly ${proteinTarget}g of protein` : ""}, ready within about ${timeMinutes} minutes. Your pantry-accurate numbers may drift a little from these — that's expected.

RULES:
- Use ONLY ingredients from their pantry (plus water, and salt/pepper if plausible). If something essential is missing, build in the substitution rather than listing the missing item.
- Use ONLY their equipment.
- Steps must be in exact order a real cook would do them, including prep steps.
- Every step gets a "detail" written for their skill level: exactly HOW to do it, what it looks/sounds/smells like when right.
- "watch_for" is the doneness cue or the failure sign — the thing nobody tells beginners.
- Set "heat" whenever a burner is involved. Set "oven_temp_c" (°C) on every step that uses the oven — including the preheat step. Set "timer_min" when waiting a fixed time matters (simmering, baking, proofing, resting).
- Amounts in practical terms ("2 tbsp", "half the onion")${hasScale ? "" : " — assume no kitchen scale"}. EXCEPT baking: give precise amounts${hasScale ? " in grams" : " in level cups and spoons"} — never "eyeball it".
- kcal_estimate/protein_g_estimate: your best estimate for one serving of the recipe you actually just wrote — not a repeat of the target above.
- needs_cooking: false only if this is genuinely a no-cook assembly.
- why: half a sentence on why this fits what they asked for. Never mention calories, macros, dieting or nutrition tracking here — that's Fitness's job, not yours.`;

  const failures: string[] = [];
  for (const model of [brain, spareBrain]) {
    try {
      const { object } = await generateObject({ model, schema: ReservedDishSchema, prompt });
      const { kcal_estimate, protein_g_estimate, needs_cooking, why, ...recipe } = object;

      const { data: recipeId, error: insertError } = await supabase.rpc(
        "ember_reserve_recipe_for_integration",
        {
          p_secret: expected,
          p_user_id: emberUserId,
          p_dish: dish,
          p_slot: slot,
          p_recipe: recipe,
          p_kcal_estimate: kcal_estimate,
          p_protein_g_estimate: protein_g_estimate,
          p_time_minutes: recipe.time_minutes,
          p_needs_cooking: needs_cooking,
          p_why: why,
          p_pantry_snapshot: pantry.map((p) => p.item),
        }
      );
      if (insertError || !recipeId) {
        return NextResponse.json(
          { error: insertError?.message ?? "reserve-failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        recipe_id: recipeId,
        title: recipe.title,
        description: recipe.description,
        kcal_estimate,
        protein_g_estimate,
        time_minutes: recipe.time_minutes,
        needs_cooking,
        why,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[nutrition/reserve] model failed:", detail);
      failures.push(detail.slice(0, 200));
    }
  }

  // Secret-gated, machine-to-machine — the detail is safe here, and Fitness
  // just falls back to a plan with no recipe reference.
  return NextResponse.json({ error: "reserve-failed", failures }, { status: 502 });
}
