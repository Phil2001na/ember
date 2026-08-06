"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ExploreDish, Recipe } from "@/lib/schemas";
import RecipePreview from "@/components/RecipePreview";
import RecipeProgress from "@/components/RecipeProgress";

type Dish = ExploreDish & { id: string };

/** loose pantry match: "tomato" matches "tomatoes", "tomato paste" etc. */
function haveIt(ingredient: string, pantry: string[]): boolean {
  const ing = ingredient.toLowerCase();
  return pantry.some((p) => {
    const pl = p.toLowerCase();
    return pl.includes(ing) || ing.includes(pl);
  });
}

export default function ExploreClient({
  dishes,
  pantry,
}: {
  dishes: Dish[];
  pantry: string[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [picked, setPicked] = useState<Dish | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateMore() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/explore", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't dream up new dishes — try again.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function pick(dish: Dish) {
    setPicked(dish);
    setRecipe(null);
    setError(null);
    try {
      const missing = dish.key_ingredients.filter((i) => !haveIt(i, pantry));
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dish.title,
          notes: missing.length
            ? `They are missing: ${missing.join(", ")}. Substitute from their pantry where possible; otherwise keep amounts of missing items minimal and note alternatives.`
            : undefined,
        }),
      });
      if (!res.ok) throw new Error("Couldn't write that recipe — try another dish.");
      setRecipe(await res.json());
    } catch (err) {
      setPicked(null);
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function startCooking() {
    if (!recipe) return;
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
    if (error || !data) return setError(error?.message ?? "Couldn't start session");
    router.push(`/cook/${data.id}`);
  }

  // recipe preview overlay
  if (picked) {
    return (
      <main className="page fade-in">
        {!recipe ? (
          <RecipeProgress title={picked.title} />
        ) : (
          <RecipePreview
            recipe={recipe}
            starting={starting}
            onStart={startCooking}
            onBack={() => {
              setPicked(null);
              setRecipe(null);
            }}
          />
        )}
      </main>
    );
  }

  return (
    <main className="page fade-in">
      <h1 className="page-title">Explore</h1>
      <p className="page-sub">Dishes you could grow into — checked against your pantry.</p>

      {error && (
        <p style={{ color: "var(--red-warn)", fontSize: "0.9rem", marginBottom: 12 }}>{error}</p>
      )}

      {dishes.length === 0 && !generating && (
        <div className="card" style={{ textAlign: "center", padding: 32, marginBottom: 16 }}>
          <p style={{ marginBottom: 16, color: "var(--text-dim)" }}>
            Nothing here yet — let Ember dream up some dishes.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {dishes.map((dish) => {
          const missing = dish.key_ingredients.filter((i) => !haveIt(i, pantry));
          return (
            <button key={dish.id} className="card" style={{ textAlign: "left" }} onClick={() => pick(dish)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <h3 style={{ fontSize: "1.1rem" }}>{dish.title}</h3>
                <span className={`badge ${missing.length === 0 ? "badge-ok" : "badge-warn"}`}>
                  {missing.length === 0 ? (
                    <>
                      <Check /> can cook now
                    </>
                  ) : (
                    `${missing.length} to buy`
                  )}
                </span>
              </div>
              <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", margin: "6px 0" }}>
                {dish.description}
              </p>
              <p style={{ color: "var(--text-faint)", fontSize: "0.8rem" }}>
                {dish.cuisine} · {dish.time_minutes} min · {dish.difficulty}
                {missing.length > 0 && missing.length <= 3 && <> · need: {missing.join(", ")}</>}
              </p>
            </button>
          );
        })}
      </div>

      <button className="btn btn-ghost btn-full" style={{ marginTop: 16 }} onClick={generateMore} disabled={generating}>
        {generating ? (
          <>
            <span className="spinner" /> Dreaming up dishes…
          </>
        ) : dishes.length ? (
          <>
            More ideas <Sparkles />
          </>
        ) : (
          <>
            Generate dishes <Sparkles />
          </>
        )}
      </button>
    </main>
  );
}
