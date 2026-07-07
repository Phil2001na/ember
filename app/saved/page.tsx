import { createClient } from "@/lib/supabase/server";
import TabBar from "@/components/TabBar";
import SavedClient from "./SavedClient";
import type { SavedRecipe } from "@/lib/schemas";

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("saved_recipes")
    .select("id, recipe, saved_at")
    .eq("user_id", user!.id)
    .order("saved_at", { ascending: false });

  return (
    <>
      <SavedClient initialRecipes={(data ?? []) as SavedRecipe[]} />
      <TabBar />
    </>
  );
}
