import Link from "next/link";
import { BookMarked, ChevronRight, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AccountCard from "./AccountCard";

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

  const [{ count: cooked }, { count: savedCount }] = await Promise.all([
    supabase
      .from("cook_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("status", "completed"),
    supabase
      .from("saved_recipes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user!.id),
  ]);

  return (
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

      <Link
        href="/saved"
        className="card"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <BookMarked size={17} style={{ color: "var(--accent-icon)" }} /> Saved recipes
        </span>
        <span style={{ color: "var(--text-faint)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          {savedCount ?? 0} <ChevronRight size={16} />
        </span>
      </Link>

      <Link
        href="/settings"
        className="card"
        style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <Settings size={17} style={{ color: "var(--accent-icon)" }} /> Settings
        </span>
        <ChevronRight size={16} style={{ color: "var(--text-faint)" }} />
      </Link>

      <AccountCard
        email={user?.email ?? user?.new_email ?? null}
        isAnonymous={user?.is_anonymous ?? true}
        emailConfirmed={Boolean(user?.email_confirmed_at)}
      />
    </main>
  );
}
