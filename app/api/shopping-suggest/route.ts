import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { ShoppingSuggestionsSchema } from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";

export const maxDuration = 60;

export async function POST() {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { object } = await generateObject({
    model: brain,
    schema: ShoppingSuggestionsSchema,
    prompt: `You are Ember, a warm and practical cooking companion. You're drafting
this person's shopping list for them — they don't really know what they want,
so be their decisive kitchen friend.

${kitchenPrompt(kitchen)}

Suggest what they should buy on their next shop. Prioritize, in order:
1. Pantry items whose quantity says they're running low or almost empty —
   restock those first (reason: "running low").
2. A few items that UNLOCK real meals with what they already have — e.g. if
   they have pasta and tomatoes but no cheese, suggest parmesan. Put 1-3
   concrete dish names in unlock_dishes so the value of that one purchase is obvious.
3. Missing everyday staples a working kitchen needs (oil, onions, garlic,
   salt, a protein) — only ones genuinely absent from their pantry.

Rules:
- NEVER suggest something already on their shopping list.
- NEVER suggest something they have plenty of in the pantry.
- Respect their dietary notes strictly.
- Keep it realistic for one normal shop — no specialty items they'd use once.
- Quantities should be normal shop sizes, not recipe amounts.`,
  });

  // Belt and braces: the model is told not to duplicate, but filter anyway.
  const listSet = new Set(kitchen.shoppingList.map((n) => n.toLowerCase()));
  const items = object.items.filter((i) => !listSet.has(i.name.toLowerCase()));

  return NextResponse.json({ items });
}
