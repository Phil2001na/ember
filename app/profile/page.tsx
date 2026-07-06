import { createClient } from "@/lib/supabase/server";
import TabBar from "@/components/TabBar";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, skill_level")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { count: cooked } = await supabase
    .from("cook_sessions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user!.id)
    .eq("status", "completed");

  return (
    <>
      <main className="page fade-in">
        <h1 className="page-title">{profile?.display_name ?? "You"}</h1>
        <p className="page-sub">{user?.email}</p>

        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontSize: "2rem", fontFamily: "var(--font-display)" }}>
            {cooked ?? 0}
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            dishes cooked with Ember
          </p>
        </div>
      </main>
      <TabBar />
    </>
  );
}
