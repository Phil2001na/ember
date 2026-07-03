"use client";

import type { Recipe } from "@/lib/schemas";

export default function RecipePreview({
  recipe,
  starting,
  onStart,
  onBack,
}: {
  recipe: Recipe;
  starting: boolean;
  onStart: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="fade-in">
      <h2 style={{ fontSize: "1.5rem", marginBottom: 4 }}>{recipe.title}</h2>
      <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: 6 }}>
        {recipe.description}
      </p>
      <p style={{ color: "var(--text-faint)", fontSize: "0.8rem", marginBottom: 18 }}>
        {recipe.time_minutes} min · serves {recipe.servings} · {recipe.steps.length} steps
      </p>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>Ingredients</h3>
        <ul style={{ listStyle: "none", display: "grid", gap: 6 }}>
          {recipe.ingredients.map((ing, i) => (
            <li key={i} style={{ fontSize: "0.92rem" }}>
              <strong>{ing.amount}</strong> {ing.item}
              {ing.prep && <span style={{ color: "var(--text-faint)" }}> — {ing.prep}</span>}
            </li>
          ))}
        </ul>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>You'll use</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {recipe.equipment.map((e, i) => (
            <span key={i} className="chip" style={{ padding: "5px 10px", fontSize: "0.8rem" }}>
              {e}
            </span>
          ))}
        </div>
      </div>

      <button className="btn btn-primary btn-full" onClick={onStart} disabled={starting} style={{ padding: "16px 20px", fontSize: "1.05rem" }}>
        {starting ? <span className="spinner" /> : "Start cooking 🔥"}
      </button>
      {onBack && (
        <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={onBack}>
          Back to ideas
        </button>
      )}
    </div>
  );
}
