import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Session-authenticated read for a recipe reserved via /api/nutrition/reserve
 * (V4, see docs/integrations/fitness-v4.md). RLS on
 * `ember.fitness_reserved_recipes` scopes rows to their own `user_id` — that
 * is what stops one kitchen from opening another's reservation by guessing
 * `recipe_id` out of a `/from/fitness` URL; there's no extra check to do here
 * beyond the plain select.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: reservation } = await supabase
    .from("fitness_reserved_recipes")
    .select("recipe, dish, pantry_snapshot, opened_at")
    .eq("id", id)
    .maybeSingle();
  if (!reservation) return NextResponse.json({ error: "not-found" }, { status: 404 });

  if (!reservation.opened_at) {
    await supabase
      .from("fitness_reserved_recipes")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", id)
      .is("opened_at", null);
  }

  // Best-effort staleness signal (contract's recommendation): the pantry may
  // have changed materially since this was reserved. Presence, not quantity,
  // is the signal — an item that's gone (or newly arrived) is what would
  // actually change the recipe.
  const { data: pantry } = await supabase.from("pantry_items").select("name").eq("user_id", user.id);
  const currentNames = new Set((pantry ?? []).map((p) => p.name));
  const snapshot = (reservation.pantry_snapshot ?? []) as string[];
  const pantryChanged =
    snapshot.length !== currentNames.size || snapshot.some((name) => !currentNames.has(name));

  return NextResponse.json({ recipe: reservation.recipe, dish: reservation.dish, pantryChanged });
}
