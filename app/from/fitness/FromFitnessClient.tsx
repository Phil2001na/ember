"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, Suggestion } from "@/lib/schemas";
import { describeIntent, intentToCraving, type NutritionIntentV1 } from "@/lib/fitnessHandoff";
import RecipePreview from "@/components/RecipePreview";
import RecipeProgress from "@/components/RecipeProgress";
import SuggestionCarousel from "@/components/SuggestionCarousel";

export default function FromFitnessClient({
  intent,
  errorReason,
}: {
  intent: NutritionIntentV1 | null;
  errorReason: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(!!intent);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [pantryChanged, setPantryChanged] = useState(false);

  // V4: Fitness already generated the recipe at planning time — open it
  // directly instead of generating anything fresh.
  useEffect(() => {
    if (!intent?.recipeId) return;
    setLoading(false);
    loadReserved(intent.recipeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.recipeId]);

  // V2: Fitness already picked the dish in its own nudge — go straight to the
  // recipe instead of asking the same question twice.
  useEffect(() => {
    if (!intent?.dish || intent.recipeId) return;
    setLoading(false);
    pick({
      title: intent.dish,
      description: "",
      time_minutes: intent.timeMinutes ?? 30,
      difficulty: "easy",
      match: "have-everything",
      missing: [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent?.dish, intent?.recipeId]);

  useEffect(() => {
    if (!intent || intent.dish || intent.recipeId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ craving: intentToCraving(intent) }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(
            res.status === 400
              ? "Your pantry's empty, so I can't suggest anything from what you have yet."
              : "Couldn't put suggestions together just now."
          );
          return;
        }
        const data = await res.json();
        setSuggestions((data.suggestions ?? []).slice(0, 3));
      } catch {
        if (!cancelled) setLoadError("Couldn't reach Ember just now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [intent]);

  async function loadReserved(recipeId: string) {
    setPicked({
      title: intent?.dish ?? "your planned dish",
      description: "",
      time_minutes: intent?.timeMinutes ?? 30,
      difficulty: "easy",
      match: "have-everything",
      missing: [],
    });
    setRecipe(null);
    setGenError(null);
    setPantryChanged(false);
    try {
      const res = await fetch(`/api/nutrition/reserved/${recipeId}`);
      if (!res.ok) throw new Error("not-found");
      const data = await res.json();
      setRecipe(data.recipe);
      setPantryChanged(!!data.pantryChanged);
    } catch {
      // Reservation is gone, expired, or not this kitchen's — fall back to
      // the normal dish flow rather than dead-ending the handoff.
      if (intent?.dish) {
        pick({
          title: intent.dish,
          description: "",
          time_minutes: intent.timeMinutes ?? 30,
          difficulty: "easy",
          match: "have-everything",
          missing: [],
        });
      } else {
        setPicked(null);
        setGenError("That planned recipe isn't available anymore.");
      }
    }
  }

  async function pick(s: Suggestion) {
    setPicked(s);
    setRecipe(null);
    setGenError(null);
    setPantryChanged(false);
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
      setRecipe(await res.json());
    } catch (err) {
      setPicked(null);
      setGenError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function startCooking(recipe: Recipe) {
    setStarting(true);
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
      setGenError(error?.message ?? "Couldn't start session");
      return;
    }
    if (intent) {
      try {
        localStorage.setItem(`ember-fitness-request-${data.id}`, intent.requestId);
        // V2: carry the rough energy figure through the cook so the return trip
        // can hand Fitness a number instead of a shrug.
        if (intent.kcalTarget || intent.proteinTargetG) {
          localStorage.setItem(
            `ember-fitness-hint-${data.id}`,
            JSON.stringify({ kcal: intent.kcalTarget, proteinG: intent.proteinTargetG })
          );
        }
      } catch {}
    }
    router.push(`/cook/${data.id}`);
  }

  // malformed/unsupported handoff — friendly recovery, never a dead end
  if (!intent) {
    return (
      <main className="page fade-in" style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100dvh", textAlign: "center" }}>
        <Activity size={36} style={{ color: "var(--accent-icon)", margin: "0 auto 14px" }} />
        <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Couldn&rsquo;t read that handoff</h1>
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: 22 }}>
          {errorReason === "unsupported-version"
            ? "That link is from a newer version of the Fitness handoff than this Ember supports."
            : "That link from Fitness looks incomplete or out of date."}
          {" "}No worries — you can still tell Ember what you feel like eating.
        </p>
        <Link href="/" className="btn btn-primary btn-full" style={{ padding: "16px 20px" }}>
          Continue to Ember
        </Link>
      </main>
    );
  }

  if (picked) {
    return (
      <main className="page fade-in">
        {!recipe ? (
          intent?.recipeId ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-dim)" }}>
              <span className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px", display: "block", color: "var(--accent-icon)" }} />
              {`Opening your ${picked.title} recipe…`}
            </div>
          ) : (
            <RecipeProgress title={picked.title} />
          )
        ) : (
          <>
            {pantryChanged && (
              <div className="card" style={{ marginBottom: 16, fontSize: "0.85rem" }}>
                <p style={{ color: "var(--text-dim)", marginBottom: intent.dish ? 10 : 0 }}>
                  Your pantry&rsquo;s changed since this was planned — still fine to cook, just maybe not
                  spot-on anymore.
                </p>
                {intent.dish && (
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      pick({
                        title: intent.dish!,
                        description: "",
                        time_minutes: intent.timeMinutes ?? 30,
                        difficulty: "easy",
                        match: "have-everything",
                        missing: [],
                      })
                    }
                  >
                    See what&rsquo;s fresh instead
                  </button>
                )}
              </div>
            )}
            <RecipePreview
              recipe={recipe}
              starting={starting}
              onStart={() => startCooking(recipe)}
              onBack={() => {
                setPicked(null);
                setRecipe(null);
              }}
            />
          </>
        )}
        {genError && <p style={{ color: "var(--red-warn)", fontSize: "0.85rem", marginTop: 12 }}>{genError}</p>}
      </main>
    );
  }

  return (
    <main className="page fade-in">
      <h1 className="page-title title-glow" style={{ fontSize: "1.35rem", marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        {describeIntent(intent)} <Flame size={20} style={{ color: "var(--accent-icon)", flexShrink: 0 }} />
      </h1>
      <p style={{ color: "var(--text-faint)", fontSize: "0.82rem", marginBottom: 20 }}>
        Here&rsquo;s what that could look like with what you&rsquo;ve got — pick one, tweak it, or ignore it entirely.
      </p>

      {loading && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-dim)" }}>
          <span className="spinner" style={{ width: 28, height: 28, margin: "0 auto 14px", display: "block", color: "var(--accent-icon)" }} />
          Thinking about it…
        </div>
      )}

      {!loading && loadError && (
        <div className="card" style={{ marginBottom: 20 }}>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem" }}>{loadError}</p>
        </div>
      )}

      {!loading && !loadError && suggestions.length > 0 && (
        <SuggestionCarousel suggestions={suggestions} onPick={pick} />
      )}

      <Link href="/" className="btn btn-ghost btn-full" style={{ marginTop: 20 }}>
        Skip — just take me to Ember
      </Link>
    </main>
  );
}
