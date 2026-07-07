import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import type { UIMessage } from "ai";
import { UsedUpSchema, type Recipe } from "@/lib/schemas";
import { loadKitchen } from "@/lib/kitchen";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!kitchen.pantry.length) return NextResponse.json({ used_up: [] });

  const { sessionId } = await request.json();
  if (!sessionId) return NextResponse.json({ error: "no sessionId" }, { status: 400 });

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("cook_sessions")
    .select("recipe, messages")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const recipe = session.recipe as Recipe;
  // cook_sessions.messages holds useChat UIMessages (parts), so pull the text out
  const chat = (session.messages as UIMessage[]) ?? [];
  const chatNotes = chat
    .map((m) => {
      const text = (m.parts ?? [])
        .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join(" ")
        .trim();
      return text ? `${m.role}: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const pantryList = kitchen.pantry
    .map((p) => (p.quantity_text ? `${p.name} (${p.quantity_text})` : p.name))
    .join(", ");

  const { object } = await generateObject({
    model: brain,
    schema: UsedUpSchema,
    prompt: `Someone just finished cooking "${recipe.title}". Work out which of their
pantry items this cook most likely FINISHED OFF, so those can be removed from
their pantry list.

THEIR PANTRY (exact names): ${pantryList}

THE RECIPE'S INGREDIENTS: ${recipe.ingredients
      .map((i) => `${i.amount} ${i.item}`)
      .join(", ")}
${chatNotes ? `\nWHAT WAS SAID WHILE COOKING (substitutions/changes count!):\n${chatNotes}\n` : ""}
Rules:
- Only list items that were plausibly USED UP COMPLETELY: fresh/perishable
  ingredients bought in cook-sized amounts (a piece of meat, fresh herbs, a
  single vegetable, cream, one tin of something).
- Staples survive a single cook: salt, pepper, spices, oil, flour, sugar, rice,
  pasta, sauces, condiments — never list these unless the chat says they ran out.
- Respect quantities in brackets: "almost empty" + used in this recipe = finished;
  "half a bag" = probably not.
- If the chat says they substituted something ("used yoghurt instead of cream"),
  the substitute is what got used, not the original.
- Use the EXACT pantry names as listed above. When unsure, leave it in the pantry
  — an empty list is a fine answer.`,
  });

  const pantryNames = new Set(kitchen.pantry.map((p) => p.name));
  const used_up = [...new Set(object.used_up.map((n) => n.trim().toLowerCase()))].filter((n) =>
    pantryNames.has(n)
  );

  return NextResponse.json({ used_up });
}
