import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { RecipeSchema } from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";

export const maxDuration = 90;

export async function POST(request: Request) {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { title, notes, mode } = await request.json();
  if (!title) return NextResponse.json({ error: "no title" }, { status: 400 });

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
- Set "heat" whenever a burner or oven is involved. Set "timer_min" when waiting
  a fixed time matters (simmering, baking, resting).
- Amounts in practical terms ("2 tbsp", "half the onion") — assume no kitchen scale.`,
  });

  return NextResponse.json(object);
}
