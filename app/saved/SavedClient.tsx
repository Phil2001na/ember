"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Share2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, SavedRecipe } from "@/lib/schemas";
import RecipePreview from "@/components/RecipePreview";
import { shareSavedRecipe } from "@/lib/shareRecipe";

export default function SavedClient({ initialRecipes }: { initialRecipes: SavedRecipe[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [recipes, setRecipes] = useState(initialRecipes);
  const [picked, setPicked] = useState<SavedRecipe | null>(null);
  const [starting, setStarting] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(id: string) {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("saved_recipes").delete().eq("id", id);
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
      setError(error?.message ?? "Couldn't start session");
      return;
    }
    router.push(`/cook/${data.id}`);
  }

  async function share(saved: SavedRecipe) {
    setSharingId(saved.id);
    setError(null);
    setShareNotice(null);
    try {
      const result = await shareSavedRecipe(saved.id, saved.recipe.title);
      setShareNotice(result === "copied" ? "Recipe link copied." : "Recipe shared.");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Couldn't share that recipe.");
    } finally {
      setSharingId(null);
    }
  }

  if (picked) {
    return (
      <main className="page fade-in">
        <RecipePreview
          recipe={picked.recipe}
          starting={starting}
          onStart={() => startCooking(picked.recipe)}
          onBack={() => setPicked(null)}
        />
      </main>
    );
  }

  return (
    <main className="page fade-in">
      <h1 className="page-title">Saved recipes</h1>
      <p className="page-sub">
        {recipes.length
          ? `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} to revisit`
          : "Nothing saved yet — finish cooking a dish and save it to find it here."}
      </p>

      {error && (
        <p style={{ color: "var(--red-warn)", fontSize: "0.9rem", marginBottom: 12 }}>{error}</p>
      )}
      {shareNotice && (
        <p className="badge badge-accent" style={{ display: "inline-flex", marginBottom: 12 }}>
          <Share2 /> {shareNotice}
        </p>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {recipes.map((r) => (
          <div
            key={r.id}
            className="card"
            style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
          >
            <button style={{ textAlign: "left", flex: 1 }} onClick={() => setPicked(r)}>
              <h3 style={{ fontSize: "1.05rem" }}>{r.recipe.title}</h3>
              <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", margin: "6px 0" }}>
                {r.recipe.description}
              </p>
              <p style={{ color: "var(--text-faint)", fontSize: "0.78rem" }}>
                {r.recipe.time_minutes} min · serves {r.recipe.servings} · {r.recipe.steps.length} steps
              </p>
            </button>
            <button
              onClick={() => share(r)}
              disabled={sharingId === r.id}
              style={{ color: "var(--accent-icon)", padding: "4px 8px", display: "inline-flex" }}
              aria-label={`Share ${r.recipe.title}`}
            >
              {sharingId === r.id ? <span className="spinner" style={{ width: 17, height: 17 }} /> : <Share2 size={17} />}
            </button>
            <button
              onClick={() => remove(r.id)}
              style={{ color: "var(--text-faint)", padding: "4px 8px", display: "inline-flex" }}
              aria-label={`Remove ${r.recipe.title}`}
            >
              <X size={17} />
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
