"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DishCheck, Recipe, Suggestion } from "@/lib/schemas";
import RecipePreview from "@/components/RecipePreview";
import RecipeProgress from "@/components/RecipeProgress";
import Skeleton from "@/components/Skeleton";

type Stage =
  | { name: "loading" }
  | { name: "empty-pantry" }
  | { name: "error"; message: string }
  | { name: "picking"; suggestions: Suggestion[] }
  | { name: "checking"; dish: string }
  | { name: "need-check"; check: DishCheck }
  | { name: "generating"; title: string }
  | { name: "preview"; recipe: Recipe };

export default function SuggestPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>({ name: "loading" });
  const [starting, setStarting] = useState(false);
  const [dishInput, setDishInput] = useState("");
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

  async function checkDish(dish: string) {
    if (!dish.trim()) return;
    setStage({ name: "checking", dish });
    try {
      const res = await fetch("/api/dish-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish }),
      });
      if (!res.ok) throw new Error("Couldn't check that dish — try again.");
      const check: DishCheck = await res.json();
      setStage({ name: "need-check", check });
    } catch (err) {
      setStage({
        name: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  async function generateFromCheck(check: DishCheck, mode: "authentic" | "improvise") {
    setStage({ name: "generating", title: check.title });
    try {
      const missing = check.ingredients.filter((i) => !i.have);
      const notes = missing.length
        ? mode === "authentic"
          ? `Still need to buy: ${missing.map((m) => `${m.item} (${m.amount})`).join(", ")}`
          : `Missing: ${missing
              .map((m) => `${m.item}${m.substitution ? ` (substitute: ${m.substitution})` : ""}`)
              .join(", ")}`
        : undefined;
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: check.title, notes, mode }),
      });
      if (!res.ok) throw new Error("Couldn't write that recipe — try again.");
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
        <div className="fade-in">
          <div className="card" style={{ marginBottom: 20 }}>
            <Skeleton width="60%" height="0.95rem" style={{ marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <Skeleton height={44} radius="var(--radius)" style={{ flex: 1 }} />
              <Skeleton width={90} height={44} radius="var(--radius)" />
            </div>
          </div>
          <Skeleton width="70%" height="0.85rem" style={{ marginBottom: 12 }} />
          <div style={{ display: "grid", gap: 12 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <Skeleton width="55%" height="1.15rem" />
                  <Skeleton width={80} height={22} radius={999} />
                </div>
                <Skeleton width="90%" height="0.9rem" style={{ marginBottom: 6 }} />
                <Skeleton width="45%" height="0.8rem" />
              </div>
            ))}
          </div>
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
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: 8 }}>Know exactly what you want?</h3>
            <form
              style={{ display: "flex", gap: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                checkDish(dishInput);
              }}
            >
              <input
                className="input"
                placeholder="e.g. chicken curry"
                value={dishInput}
                onChange={(e) => setDishInput(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={!dishInput.trim()}>
                Check it
              </button>
            </form>
          </div>

          <p className="page-sub">From what's in your kitchen right now:</p>
          <div style={{ display: "grid", gap: 12 }}>
            {stage.suggestions.map((s, i) => (
              <button key={i} className="card fade-in" style={{ textAlign: "left" }} onClick={() => pick(s)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <h3 style={{ fontSize: "1.15rem" }}>{s.title}</h3>
                  <span className={`badge ${s.match === "have-everything" ? "badge-ok" : "badge-warn"}`}>
                    {s.match === "have-everything" ? (
                      <>
                        <Check /> have it all
                      </>
                    ) : (
                      `${s.missing.length} missing`
                    )}
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

      {stage.name === "checking" && (
        <div className="fade-in">
          <Skeleton width="50%" height="1.3rem" style={{ marginBottom: 8 }} />
          <Skeleton width="85%" height="0.9rem" style={{ marginBottom: 6 }} />
          <Skeleton width="40%" height="0.8rem" style={{ marginBottom: 18 }} />
          <div className="card">
            <Skeleton width="45%" height="1rem" style={{ marginBottom: 10 }} />
            <div style={{ display: "grid", gap: 10 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <Skeleton width={`${65 - i * 5}%`} height="0.92rem" />
                  <Skeleton width={62} height={20} radius={999} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage.name === "need-check" && (
        <div className="fade-in">
          <h2 style={{ fontSize: "1.3rem", marginBottom: 4 }}>{stage.check.title}</h2>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: 6 }}>
            {stage.check.description}
          </p>
          <p style={{ color: "var(--text-faint)", fontSize: "0.8rem", marginBottom: 18 }}>
            {stage.check.time_minutes} min · {stage.check.difficulty}
          </p>

          <div className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>What you'll need</h3>
            <ul style={{ listStyle: "none", display: "grid", gap: 8 }}>
              {stage.check.ingredients.map((ing, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, fontSize: "0.92rem" }}>
                  <span>
                    <strong>{ing.amount}</strong> {ing.item}
                    {!ing.have && ing.substitution && (
                      <span style={{ color: "var(--text-faint)", display: "block", fontSize: "0.8rem" }}>
                        have instead: {ing.substitution}
                      </span>
                    )}
                  </span>
                  <span className={`badge ${ing.have ? "badge-ok" : "badge-warn"}`} style={{ flexShrink: 0 }}>
                    {ing.have ? (
                      <>
                        <Check /> have it
                      </>
                    ) : (
                      "need it"
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!stage.check.can_improvise && stage.check.improvise_note && (
            <p style={{ color: "var(--red-warn)", fontSize: "0.85rem", marginBottom: 14 }}>
              {stage.check.improvise_note}
            </p>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            <button
              className="btn btn-primary btn-full"
              onClick={() => generateFromCheck(stage.check, "authentic")}
            >
              Let me get the rest
            </button>
            <button
              className="btn btn-ghost btn-full"
              disabled={!stage.check.can_improvise}
              title={stage.check.can_improvise ? undefined : stage.check.improvise_note ?? "Too much is missing to improvise this one"}
              onClick={() => generateFromCheck(stage.check, "improvise")}
            >
              Improvise with what I have
            </button>
            <button className="btn btn-ghost btn-full" onClick={() => fetchSuggestions()}>
              Back to ideas
            </button>
          </div>
        </div>
      )}

      {stage.name === "generating" && <RecipeProgress title={stage.title} />}

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
