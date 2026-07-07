import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { DishCheckSchema } from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";

export const maxDuration = 60;

export async function POST(request: Request) {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { dish } = await request.json().catch(() => ({ dish: null }));
  if (!dish || !String(dish).trim()) {
    return NextResponse.json({ error: "no dish" }, { status: 400 });
  }

  const { object } = await generateObject({
    model: brain,
    schema: DishCheckSchema,
    prompt: `You are Ember, a warm and practical cooking companion.

${kitchenPrompt(kitchen)}

The cook told you they want to make: "${dish}"

Work out the real, proper ingredient list for this dish, then check each ingredient
against their pantry.
Rules:
- List ingredients for an authentic, correctly-made version of the dish — don't
  water it down just because they're missing things.
- For each ingredient, set "have" true only if they actually have that item (or a
  near-identical one) in their pantry.
- For anything they don't have, suggest a "substitution" only if a pantry item
  would genuinely work in this specific dish. Use null if nothing in their pantry
  is a reasonable substitute.
- Set "can_improvise" to true only if EVERY missing ingredient either has a real
  substitution, or is minor enough to skip without ruining the dish (e.g. a
  garnish). If a defining, essential ingredient is missing with no workable
  substitute, "can_improvise" must be false.
- If "can_improvise" is false, "improvise_note" should plainly say what's missing
  and why it can't be worked around — one or two sentences, no hedging.`,
  });

  return NextResponse.json(object);
}
