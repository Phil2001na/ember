"use client";

import { useState } from "react";
import {
  Carrot,
  ChevronDown,
  ChevronUp,
  Coffee,
  CookingPot,
  Flame,
  Microwave,
  Refrigerator,
  Ruler,
  Scale,
  Slice,
  Soup,
  Timer,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { Recipe } from "@/lib/schemas";

const INGREDIENTS_COLLAPSED = 7;

// equipment is free text from the model — best-effort keyword → icon match
const EQUIP_ICONS: [RegExp, LucideIcon][] = [
  [/pot|pan|skillet|dutch/i, CookingPot],
  [/knife|chop|slice/i, Slice],
  [/bowl|soup/i, Soup],
  [/measur|cup|spoon(s)?\b.*measur/i, Ruler],
  [/scale|weigh/i, Scale],
  [/microwave/i, Microwave],
  [/oven|stove|hob|burner|grill/i, Flame],
  [/fridge|refrigerator|freezer/i, Refrigerator],
  [/kettle/i, Coffee],
  [/timer/i, Timer],
];

function equipIcon(name: string): LucideIcon {
  for (const [re, Icon] of EQUIP_ICONS) if (re.test(name)) return Icon;
  return Utensils;
}

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
  const [showAll, setShowAll] = useState(false);
  const collapsed = !showAll && recipe.ingredients.length > INGREDIENTS_COLLAPSED;
  const visible = collapsed ? recipe.ingredients.slice(0, INGREDIENTS_COLLAPSED) : recipe.ingredients;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: "2rem", marginBottom: 4 }}>
        Let&rsquo;s get <span className="accent-serif">cooking</span>.
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: "1rem", marginBottom: 6 }}>
        Here&rsquo;s what you&rsquo;ll need.
      </p>
      <p style={{ color: "var(--text-faint)", fontSize: "0.82rem", marginBottom: 20 }}>
        {recipe.title} · {recipe.time_minutes} min · serves {recipe.servings} · {recipe.steps.length} steps
      </p>

      <div className="section-head">
        <Carrot />
        Ingredients
      </div>
      <div className="card list-card" style={{ marginBottom: 20 }}>
        {visible.map((ing, i) => (
          <div key={i} className="list-row">
            <span className="list-dot" />
            <span>
              <strong>{ing.amount}</strong> {ing.item}
              {ing.prep && <span style={{ color: "var(--text-faint)" }}> — {ing.prep}</span>}
            </span>
          </div>
        ))}
        {recipe.ingredients.length > INGREDIENTS_COLLAPSED && (
          <button
            className="list-row"
            style={{ width: "100%", justifyContent: "center", color: "var(--text-dim)", fontSize: "0.88rem" }}
            onClick={() => setShowAll((s) => !s)}
          >
            {collapsed ? (
              <>
                View all ingredients <ChevronDown size={16} />
              </>
            ) : (
              <>
                Show fewer <ChevronUp size={16} />
              </>
            )}
          </button>
        )}
      </div>

      <div className="section-head">
        <Utensils />
        You&rsquo;ll use
      </div>
      <div className="equip-grid" style={{ marginBottom: 24 }}>
        {recipe.equipment.map((e, i) => {
          const Icon = equipIcon(e);
          return (
            <span key={i} className="equip-tile">
              <Icon />
              {e}
            </span>
          );
        })}
      </div>

      <button className="btn btn-primary btn-full" onClick={onStart} disabled={starting} style={{ padding: "16px 20px", fontSize: "1.05rem" }}>
        {starting ? (
          <span className="spinner" />
        ) : (
          <>
            Start cooking <Flame />
          </>
        )}
      </button>
      {onBack && (
        <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={onBack}>
          Back to ideas
        </button>
      )}
    </div>
  );
}
