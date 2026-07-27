import { createClient } from "@/lib/supabase/server";
import ExploreClient from "./ExploreClient";
import type { ExploreDish } from "@/lib/schemas";

export default async function ExplorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: dishes }, { data: pantry }] = await Promise.all([
    supabase
      .from("explore_dishes")
      .select("id, dish")
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("pantry_items").select("name").eq("user_id", user!.id),
  ]);

  return (
    <ExploreClient
      dishes={(dishes ?? []).map((d) => ({ id: d.id as string, ...(d.dish as ExploreDish) }))}
      pantry={(pantry ?? []).map((p) => p.name as string)}
    />
  );
}
