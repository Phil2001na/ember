"use client";

import { Flame } from "lucide-react";
import type { RecipeStep } from "@/lib/schemas";

const LEVELS: NonNullable<RecipeStep["heat"]>[] = [
  "off",
  "low",
  "medium-low",
  "medium",
  "medium-high",
  "high",
];

export default function HeatDial({
  heat,
  label,
  active,
}: {
  heat: NonNullable<RecipeStep["heat"]>;
  label: string;
  active: boolean;
}) {
  const fraction = LEVELS.indexOf(heat) / (LEVELS.length - 1);
  const warm = heat === "high" || heat === "medium-high";
  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <div className="heat-dial">
      <svg viewBox="0 0 100 100" className={`heat-dial-ring${active ? " heat-dial-active" : ""}`}>
        <circle cx="50" cy="50" r={r} className="heat-dial-track" strokeWidth="8" fill="none" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="heat-dial-arc"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
          style={{ stroke: warm ? "var(--ember-500)" : "var(--amber-400)" }}
        />
      </svg>
      <Flame size={22} className="heat-dial-flame" style={{ color: warm ? "var(--ember-400)" : "var(--amber-300)" }} />
      <span className="heat-dial-label" style={{ color: warm ? "var(--ember-300)" : "var(--amber-300)" }}>
        {label}
      </span>
    </div>
  );
}
