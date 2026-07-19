"use client";

import { Flame, Thermometer } from "lucide-react";
import type { RecipeStep } from "@/lib/schemas";

const LEVELS: NonNullable<RecipeStep["heat"]>[] = [
  "off",
  "low",
  "medium-low",
  "medium",
  "medium-high",
  "high",
];

// Domestic ovens top out around 250°C — used to scale the arc for oven steps.
const OVEN_MAX_C = 250;

export default function HeatDial({
  heat,
  tempC,
  label,
  active,
}: {
  heat?: NonNullable<RecipeStep["heat"]>;
  tempC?: number;
  label: string;
  active: boolean;
}) {
  const oven = tempC != null;
  const fraction = oven
    ? Math.min(1, Math.max(0, tempC / OVEN_MAX_C))
    : LEVELS.indexOf(heat ?? "off") / (LEVELS.length - 1);
  const warm = oven ? tempC >= 180 : heat === "high" || heat === "medium-high";
  const Icon = oven ? Thermometer : Flame;
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
      <Icon size={22} className="heat-dial-flame" style={{ color: warm ? "var(--ember-400)" : "var(--amber-300)" }} />
      <span className="heat-dial-label" style={{ color: warm ? "var(--ember-300)" : "var(--amber-300)" }}>
        {label}
      </span>
    </div>
  );
}
