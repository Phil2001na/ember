import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { ExploreDishesSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 90;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: existing } = await supabase
    .from("explore_dishes")
    .select("dish")
    .order("created_at", { ascending: false })
    .limit(30);

  const existingTitles = (existing ?? [])
    .map((e) => (e.dish as { title?: string }).title)
    .filter(Boolean);

  const { object } = await generateObject({
    model: brain,
    schema: ExploreDishesSchema,
    prompt: `You are Ember, a cooking companion for home cooks in Namibia and beyond.

Generate a fresh batch of dishes worth exploring — a spread from very approachable
comfort food to a couple of "level up" challenges. Mix cuisines; include at least one
southern-African dish and at least one baked good (a bread, dessert, or savoury bake).
Everyday supermarket ingredients only, no specialty equipment beyond a normal home kitchen.
${existingTitles.length ? `\nDo NOT repeat any of these existing dishes: ${existingTitles.join(", ")}` : ""}`,
  });

  const rows = object.dishes.map((dish) => ({
    dish,
    tags: [dish.cuisine.toLowerCase(), dish.difficulty],
  }));
  const { error } = await supabase.from("explore_dishes").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ added: rows.length });
}
