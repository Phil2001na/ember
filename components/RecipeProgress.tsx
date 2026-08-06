"use client";

import { useEffect, useState } from "react";
import RecipePreviewSkeleton from "./RecipePreviewSkeleton";

const STEPS = [
  "Checking your pantry…",
  "Working out the ingredients…",
  "Writing the steps…",
  "Plating it up…",
];

// The API call is a single blocking request with no real progress to report,
// so this fakes forward motion through the steps above — it keeps the wait
// from reading as frozen without pretending to know how long it'll take.
export default function RecipeProgress({ title }: { title: string }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = STEPS.slice(1).map((_, i) =>
      setTimeout(() => setStep(i + 1), (i + 1) * 3500)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const percent = Math.min(((step + 1) / STEPS.length) * 100, 92);

  return (
    <div className="fade-in">
      <p className="page-sub" style={{ marginBottom: 8 }}>
        Writing your {title} recipe…
      </p>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: "var(--accent-soft)",
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percent}%`,
            borderRadius: 999,
            background: "linear-gradient(90deg, var(--accent-icon-soft), var(--accent-amber))",
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 18 }}>
        {STEPS[step]}
      </p>
      <RecipePreviewSkeleton />
    </div>
  );
}
