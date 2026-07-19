import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { SuggestionsSchema } from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";

export const maxDuration = 60;

export async function POST(request: Request) {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!kitchen.pantry.length) {
    return NextResponse.json({ error: "empty-pantry" }, { status: 400 });
  }

  const { craving } = await request.json().catch(() => ({ craving: null }));

  const { object } = await generateObject({
    model: brain,
    schema: SuggestionsSchema,
    prompt: `You are Ember, a warm and practical cooking companion.

${kitchenPrompt(kitchen)}

Suggest 3-5 dishes this person could realistically cook RIGHT NOW.
Rules:
- Strongly prefer dishes where they have everything ("have-everything").
- A dish may be "missing-few" only if 1-2 items are missing AND you can offer a
  workable substitution from their pantry, or the item is cheap and common.
- Only use equipment they actually have.
- Match difficulty to their skill level — a beginner gets forgiving dishes.
- Make descriptions appetizing and concrete, not generic.
- Baking counts too: if their pantry supports it (flour, sugar, eggs, butter…) and
  they have an oven, one suggestion may be a baked good — bread, muffins, a dessert.
- Real, satisfying meals — not "toast with butter" filler.${
      craving ? `\n- They said they're in the mood for: "${craving}". Weight suggestions toward that.` : ""
    }`,
  });

  return NextResponse.json(object);
}
