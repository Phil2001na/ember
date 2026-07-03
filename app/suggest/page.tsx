"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, Suggestion } from "@/lib/schemas";
import RecipePreview from "@/components/RecipePreview";

type Stage =
  | { name: "loading" }
  | { name: "empty-pantry" }
  | { name: "error"; message: string }
  | { name: "picking"; suggestions: Suggestion[] }
  | { name: "generating"; title: string }
  | { name: "preview"; recipe: Recipe };

export default function SuggestPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: "loading" });
  const [starting, setStarting] = useState(false);
  const fetched = useRef(false);

  async function fetchSuggestions(craving?: string) {
    setStage({ name: "loading" });
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ craving: craving ?? null }),
      });
      if (res.status === 400) return setStage({ name: "empty-pantry" });
      if (!res.ok) throw new Error("The kitchen brain is busy — try again.");
      const data = await res.json();
      setStage({ name: "picking", suggestions: data.suggestions });
    } catch (err) {
      setStage({
        name: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetchSuggestions();
  }, []);

  async function pick(s: Suggestion) {
    setStage({ name: "generating", title: s.title });
    try {
      const notes = s.missing.length
        ? `Missing: ${s.missing
            .map((m) => `${m.item}${m.substitution ? ` (substitute: ${m.substitution})` : ""}`)
            .join(", ")}`
        : undefined;
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: s.title, notes }),
      });
      if (!res.ok) throw new Error("Couldn't write that recipe — try another dish.");
      const recipe: Recipe = await res.json();
      setStage({ name: "preview", recipe });
    } catch (err) {
      setStage({
        name: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  async function startCooking(recipe: Recipe) {
    setStarting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("cook_sessions")
      .insert({ user_id: user!.id, recipe, status: "active" })
      .select("id")
      .single();
    setStarting(false);
    if (error || !data) {
      return setStage({ name: "error", message: error?.message ?? "Couldn't start session" });
    }
    router.push(`/cook/${data.id}`);
  }

  return (
    <main className="page fade-in">
      <h1 className="page-title">What can I make?</h1>

      {stage.name === "loading" && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
          <span className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px", display: "block", color: "var(--ember-400)" }} />
          Reading your pantry, thinking of dinner…
        </div>
      )}

      {stage.name === "empty-pantry" && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ marginBottom: 16 }}>Your pantry is empty — Ember needs to know what you have.</p>
          <Link href="/pantry" className="btn btn-primary">
            Fill my pantry
          </Link>
        </div>
      )}

      {stage.name === "error" && (
        <div className="card" style={{ textAlign: "center", padding: 32 }}>
          <p style={{ color: "var(--red-warn)", marginBottom: 16 }}>{stage.message}</p>
          <button className="btn btn-ghost" onClick={() => fetchSuggestions()}>
            Try again
          </button>
        </div>
      )}

      {stage.name === "picking" && (
        <>
          <p className="page-sub">From what's in your kitchen right now:</p>
          <div style={{ display: "grid", gap: 12 }}>
            {stage.suggestions.map((s, i) => (
              <button key={i} className="card fade-in" style={{ textAlign: "left" }} onClick={() => pick(s)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <h3 style={{ fontSize: "1.15rem" }}>{s.title}</h3>
                  <span className={`badge ${s.match === "have-everything" ? "badge-ok" : "badge-warn"}`}>
                    {s.match === "have-everything" ? "✓ have it all" : `${s.missing.length} missing`}
                  </span>
                </div>
                <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", margin: "6px 0" }}>{s.description}</p>
                <p style={{ color: "var(--text-faint)", fontSize: "0.8rem" }}>
                  {s.time_minutes} min · {s.difficulty}
                  {s.missing.length > 0 && (
                    <>
                      {" · "}
                      {s.missing
                        .map((m) => (m.substitution ? `${m.item} → ${m.substitution}` : `need ${m.item}`))
                        .join(", ")}
                    </>
                  )}
                </p>
              </button>
            ))}
          </div>
          <button className="btn btn-ghost btn-full" style={{ marginTop: 16 }} onClick={() => fetchSuggestions()}>
            Show me different ideas
          </button>
        </>
      )}

      {stage.name === "generating" && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
          <span className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px", display: "block", color: "var(--ember-400)" }} />
          Writing your {stage.title} recipe, step by step…
        </div>
      )}

      {stage.name === "preview" && (
        <RecipePreview
          recipe={stage.recipe}
          starting={starting}
          onStart={() => startCooking(stage.recipe)}
          onBack={() => fetchSuggestions()}
        />
      )}
    </main>
  );
}
