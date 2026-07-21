import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { PantryImportSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { text } = (await request.json()) as { text?: string };
  const description = text?.trim();
  if (!description) {
    return NextResponse.json({ error: "Tell Ember what is in your kitchen first." }, { status: 400 });
  }
  if (description.length > 6_000) {
    return NextResponse.json({ error: "That kitchen note is a little too long." }, { status: 400 });
  }

  const { object } = await generateObject({
    model: brain,
    schema: PantryImportSchema,
    prompt: `Extract the food ingredients this person says they currently have into a pantry list.

THEIR CASUAL DESCRIPTION:
${description}

Rules:
- Capture food and cooking ingredients only, not appliances, crockery, or vague categories.
- Normalize names to concise lowercase singular ingredient names.
- Preserve a quantity only when they actually gave one. Never invent quantities.
- Include imperfect, ordinary items such as sauces, spices, bread, leftovers, and frozen food.
- Deduplicate repeated ingredients.
- Do not infer ingredients they did not mention.`,
  });

  return NextResponse.json(object);
}
