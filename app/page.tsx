import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TabBar from "@/components/TabBar";

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
      <main className="page fade-in">
        <h1 className="page-title">
          {greeting}
          {profile.display_name ? `, ${profile.display_name}` : ""} 🔥
        </h1>
        <p className="page-sub">
          {pantryCount
            ? `${pantryCount} ingredient${pantryCount === 1 ? "" : "s"} in your pantry.`
            : "Your pantry is empty — snap a photo to get started."}
        </p>

        {activeSession && (
          <Link href={`/cook/${activeSession.id}`}>
            <div className="card" style={{ marginBottom: 16, borderColor: "var(--ember-500)" }}>
              <span className="badge badge-accent">Cooking now</span>
              <h3 style={{ margin: "8px 0 2px" }}>
                {(activeSession.recipe as { title?: string })?.title ?? "Your dish"}
              </h3>
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
                Step {activeSession.current_step + 1} — tap to jump back in
              </p>
            </div>
          </Link>
        )}

        <div style={{ display: "grid", gap: 12 }}>
          <Link href="/suggest" className="btn btn-primary btn-full" style={{ padding: "18px 20px", fontSize: "1.1rem" }}>
            What can I make?
          </Link>
          <Link href="/pantry" className="btn btn-ghost btn-full">
            Update my pantry
          </Link>
        </div>
      </main>
      <TabBar />
    </>
  );
}
