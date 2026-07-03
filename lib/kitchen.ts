import { createClient } from "@/lib/supabase/server";

export type KitchenContext = {
  userId: string;
  skillLevel: string;
  dietaryNotes: string | null;
  equipment: string[];
  pantry: { name: string; quantity_text: string | null }[];
};

/** Loads everything the AI needs to know about this user's kitchen. */
export async function loadKitchen(): Promise<KitchenContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: equipment }, { data: pantry }] =
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
    ]);

  return {
    userId: user.id,
    skillLevel: profile?.skill_level ?? "beginner",
    dietaryNotes: profile?.dietary_notes ?? null,
    equipment: equipment?.map((e) => e.name) ?? [],
    pantry: pantry ?? [],
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
THEIR PANTRY (everything they have): ${pantryList || "empty"}.`;
}
