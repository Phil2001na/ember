import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TabBar from "@/components/TabBar";
import KitchenChat from "@/components/KitchenChat";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");

  const [{ count: pantryCount }, { data: activeSession }] = await Promise.all([
    supabase
      .from("pantry_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("cook_sessions")
      .select("id, recipe, current_step, started_at")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <KitchenChat
        greeting={`${greeting}${profile.display_name ? `, ${profile.display_name}` : ""}`}
        pantryEmpty={!pantryCount}
        activeSession={
          activeSession
            ? {
                id: activeSession.id,
                title: (activeSession.recipe as { title?: string })?.title ?? "Your dish",
                step: activeSession.current_step,
              }
            : null
        }
      />
      <TabBar />
    </>
  );
}
