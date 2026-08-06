import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { brain, reasoningEffort } from "@/lib/ai";
import { createMachineClient } from "@/lib/supabase/machine";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Fitness → Ember, V2 (machine-to-machine).
 *
 * Fitness describes the size of the hole to fill; Ember answers with dishes
 * from the actual pantry plus rough energy figures. Fitness never receives the
 * pantry itself — only the dishes that come out of it.
 */

const SuggestionSchema = z.object({
  title: z.string().describe("The dish, as you'd say it out loud"),
  description: z.string().describe("One appetising, concrete sentence"),
  kcal_estimate: z.number().int().min(50).max(2000).describe("Rough calories for one serving"),
  protein_g_estimate: z.number().int().min(0).max(150).describe("Rough protein in grams"),
  time_minutes: z.number().int().min(1).max(180),
  needs_cooking: z.boolean(),
  why: z.string().describe("Half a sentence on why this fits what they need right now"),
});

const ResponseSchema = z.object({
  suggestions: z.array(SuggestionSchema).min(1).max(3),
  lazy_option: SuggestionSchema.describe(
    "A no-cook, minimal-effort option from the same pantry — the thing they'd actually eat when they can't be bothered"
  ),
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

  const kcal = Math.min(2000, Math.max(100, Number(body?.kcal_target) || 600));
  const proteinTarget = Math.min(150, Math.max(0, Number(body?.protein_target_g) || 0));
  const timeMinutes = Math.min(120, Math.max(5, Number(body?.time_minutes) || 30));
  const slot = String(body?.slot ?? "meal").replace(/_/g, " ");
  const goal = String(body?.goal ?? "maintain");
  const urgency = String(body?.urgency ?? "steady");

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

  if (!pantry.length) {
    return NextResponse.json({ error: "empty-pantry", suggestions: [] }, { status: 200 });
  }

  const goalLine =
    goal === "gain"
      ? "They are deliberately trying to put weight on, so lean towards calorie-dense, easy-to-finish food. Do not suggest anything 'light'."
      : goal === "lighter"
        ? "They are eating slightly lighter, so favour filling food that isn't heavy."
        : "They are holding steady.";

  const prompt = `You are Ember, deciding what this person could eat right now from their own kitchen.

THEIR PANTRY:
${pantry.map((p) => `- ${p.item}${p.qty ? ` (${p.qty})` : ""}`).join("\n")}

EQUIPMENT: ${equipment.length ? equipment.join(", ") : "basic stovetop only"}
SKILL: ${skill}${dietary ? `\nDIETARY NOTES: ${dietary}` : ""}

WHAT THEY NEED:
- This is ${slot}, and it should land around ${kcal} kcal${proteinTarget ? ` with roughly ${proteinTarget}g of protein` : ""}.
- Ready within about ${timeMinutes} minutes.
- ${goalLine}
${urgency === "catchup" ? "- It is late in the day and they are well short of target. Prioritise speed and density over ambition." : ""}
${urgency === "behind" ? "- They're behind for the day. Favour things that are quick to get on the plate." : ""}

RULES:
- Only use ingredients they actually have, or something so common it's safe to assume (salt, water, oil).
- Only use equipment they have.
- Give 2-3 real suggestions, then one lazy_option: no cooking at all, assembled in a couple of minutes, still hitting a decent share of the calories. This is the one they'll take on a bad day — make it genuinely appealing, not a punishment.
- Energy and protein numbers are deliberately rough working estimates. Give a sensible figure for one serving and move on.
- Never mention calorie counting, macros, dieting or nutrition tracking in the description or why — that's Fitness's job, not yours. Just talk about food.`;

  // Nobody is watching this call, so surface the failure detail rather than a
  // bare 502 — this route is secret-gated and machine-to-machine, so it's safe
  // to include and saves a redeploy when debugging.
  try {
    const { object } = await generateObject({
      model: brain,
      providerOptions: reasoningEffort,
      schema: ResponseSchema,
      prompt,
    });
    return NextResponse.json(object);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[nutrition/suggest] model failed:", detail);
    return NextResponse.json({ error: "suggest-failed", failures: [detail.slice(0, 200)] }, { status: 502 });
  }
}
