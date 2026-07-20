import { createClient } from "@/lib/supabase/server";
import TabBar from "@/components/TabBar";
import ShoppingClient from "./ShoppingClient";
import type { PlannedMeal, ShoppingItem } from "@/lib/schemas";

export default async function ShoppingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: items }, { data: pantry }, { data: planned }] = await Promise.all([
    supabase
      .from("shopping_items")
      .select("id, name, quantity_text, reason, checked, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase.from("pantry_items").select("name").eq("user_id", user!.id),
    supabase
      .from("planned_meals")
      .select("id, title, ingredients, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <ShoppingClient
        initialItems={(items ?? []) as ShoppingItem[]}
        pantryNames={pantry?.map((p) => p.name) ?? []}
        initialPlanned={(planned ?? []) as PlannedMeal[]}
        userId={user!.id}
      />
      <TabBar />
    </>
  );
}
