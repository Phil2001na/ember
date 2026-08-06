import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { brain, reasoningEffort } from "@/lib/ai";
import { RecipeSchema } from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";

export const maxDuration = 90;

export async function POST(request: Request) {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { title, notes, mode } = await request.json();
  if (!title) return NextResponse.json({ error: "no title" }, { status: 400 });

  const hasScale = kitchen.equipment.some((e) => /scale/i.test(e));

  const ingredientRule =
    mode === "authentic"
      ? `- This is the proper, standard version of the dish. Use the real, correct
  ingredients — assume the cook will buy anything they don't already have rather
  than substituting it away.`
      : `- Use ONLY ingredients from their pantry (plus water, and salt/pepper if plausible).
  If something essential is missing, build in the substitution rather than listing
  the missing item.`;

  const { object } = await generateObject({
    model: brain,
    providerOptions: reasoningEffort,
    schema: RecipeSchema,
    prompt: `You are Ember, a cooking coach for someone who was never taught to cook.

${kitchenPrompt(kitchen)}

Write the complete recipe for: "${title}"${notes ? `\nContext: ${notes}` : ""}

Rules:
${ingredientRule}
- Use ONLY their equipment.
- Steps must be in exact order a real cook would do them, including prep steps.
- Every step gets a "detail" written for their skill level: exactly HOW to do it,
  what it looks/sounds/smells like when right.
- "watch_for" is the doneness cue or the failure sign — the thing nobody tells
  beginners ("if the garlic turns dark brown it's burnt, start over").
- Set "heat" whenever a burner is involved. Set "oven_temp_c" (°C) on every step
  that uses the oven — including the preheat step. Set "timer_min" when waiting
  a fixed time matters (simmering, baking, proofing, resting).
- Long passive waits (proofing, marinating, cooling) get their own step with
  "timer_min" set and a "detail" explaining what's happening and what ready looks like.
- Amounts in practical terms ("2 tbsp", "half the onion")${hasScale ? "" : " — assume no kitchen scale"}.
  EXCEPT baking: baking is chemistry, so for baked goods give precise amounts${
    hasScale
      ? " in grams (they have a kitchen scale)"
      : " in level cups and spoons (no kitchen scale)"
  } — never "eyeball it".`,
  });

  return NextResponse.json(object);
}
