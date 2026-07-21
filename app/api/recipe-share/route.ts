import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ShareRequestSchema = z.object({ savedRecipeId: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = ShareRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid recipe" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: savedRecipe } = await supabase
    .from("saved_recipes")
    .select("id, recipe")
    .eq("id", parsed.data.savedRecipeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!savedRecipe) return NextResponse.json({ error: "recipe not found" }, { status: 404 });

  const { data: existing } = await supabase
    .from("recipe_shares")
    .select("id")
    .eq("saved_recipe_id", savedRecipe.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ id: existing.id });

  const { data: share, error } = await supabase
    .from("recipe_shares")
    .insert({ user_id: user.id, saved_recipe_id: savedRecipe.id, recipe: savedRecipe.recipe })
    .select("id")
    .single();

  if (error || !share) {
    return NextResponse.json({ error: error?.message ?? "could not share recipe" }, { status: 500 });
  }
  return NextResponse.json({ id: share.id });
}
