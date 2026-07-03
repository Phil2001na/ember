import { createClient } from "@/lib/supabase/server";
import TabBar from "@/components/TabBar";
import PantryClient from "./PantryClient";
import type { PantryItem } from "@/lib/schemas";

export default async function PantryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: items } = await supabase
    .from("pantry_items")
    .select("id, name, quantity_text, source, updated_at")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PantryClient initialItems={(items ?? []) as PantryItem[]} userId={user!.id} />
      <TabBar />
    </>
  );
}
