import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KitchenChat from "@/components/KitchenChat";
import { homeNudge } from "@/lib/homeNudge";
import type { UIMessage } from "ai";

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

  const [{ data: pantry }, { data: activeSession }, { data: recentMessages }] = await Promise.all([
    supabase
      .from("pantry_items")
      .select("name, quantity_text")
      .eq("user_id", user!.id),
    supabase
      .from("cook_sessions")
      .select("id, recipe, current_step, started_at")
      .eq("user_id", user!.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("kitchen_messages")
      .select("id, role, parts")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const windhoekParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Windhoek",
      hour: "2-digit",
      day: "2-digit",
      month: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value])
  );
  const hour = Number(windhoekParts.hour);
  const greeting = hour < 11 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dayKey = Number(windhoekParts.month) * 31 + Number(windhoekParts.day);

  return (
    <KitchenChat
      greeting={`${greeting}${profile.display_name ? `, ${profile.display_name}` : ""}`}
      pantryEmpty={!pantry?.length}
      initialMessages={((recentMessages ?? [])
        .reverse()
        .map((message) => ({ id: message.id, role: message.role, parts: message.parts })) as UIMessage[])}
      nudge={homeNudge(hour, pantry ?? [], dayKey)}
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
  );
}
