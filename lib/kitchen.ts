import { createClient } from "@/lib/supabase/server";

export type KitchenContext = {
  userId: string;
  skillLevel: string;
  dietaryNotes: string | null;
  equipment: string[];
  pantry: { name: string; quantity_text: string | null }[];
  shoppingList: string[];
  preferences: string[];
  recentCooked: string[];
};

/** Loads everything the AI needs to know about this user's kitchen. */
export async function loadKitchen(): Promise<KitchenContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: equipment }, { data: pantry }, { data: shopping }, { data: preferences }, { data: recentSessions }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("skill_level, dietary_notes")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("equipment").select("name").eq("user_id", user.id),
      supabase
        .from("pantry_items")
        .select("name, quantity_text")
        .eq("user_id", user.id),
      supabase.from("shopping_items").select("name").eq("user_id", user.id),
      supabase
        .from("kitchen_preferences")
        .select("text")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("cook_sessions")
        .select("recipe")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5),
    ]);

  return {
    userId: user.id,
    skillLevel: profile?.skill_level ?? "beginner",
    dietaryNotes: profile?.dietary_notes ?? null,
    equipment: equipment?.map((e) => e.name) ?? [],
    pantry: pantry ?? [],
    shoppingList: shopping?.map((s) => s.name) ?? [],
    preferences: preferences?.map((p) => p.text) ?? [],
    recentCooked:
      recentSessions
        ?.map((s) => (s.recipe as { title?: string } | null)?.title)
        .filter((title): title is string => Boolean(title)) ?? [],
  };
}

export function kitchenPrompt(k: KitchenContext): string {
  const pantryList = k.pantry
    .map((p) => (p.quantity_text ? `${p.name} (${p.quantity_text})` : p.name))
    .join(", ");
  return `THE COOK: skill level "${k.skillLevel}"${
    k.dietaryNotes ? `, dietary notes: ${k.dietaryNotes}` : ""
  }.
THEIR EQUIPMENT: ${k.equipment.join(", ") || "unknown — assume just a stove and basic pots"}.
THEIR PANTRY (everything they have): ${pantryList || "empty"}.
THEIR SHOPPING LIST (planning to buy, they do NOT have these yet): ${
    k.shoppingList.join(", ") || "empty"
  }.
THEIR CONFIRMED COOKING PREFERENCES: ${k.preferences.length ? k.preferences.map((p) => `"${p}"`).join("; ") : "none yet"}.
RECENTLY COOKED: ${k.recentCooked.join(", ") || "nothing recorded yet"}.`;
}
