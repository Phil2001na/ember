"use client";

import type { Suggestion } from "@/lib/schemas";

export default function SuggestionCarousel({
  suggestions,
  onPick,
  onAddMissing,
}: {
  suggestions: Suggestion[];
  onPick: (s: Suggestion) => void;
  onAddMissing?: (s: Suggestion) => void;
}) {
  return (
    <div className="hscroll">
      {suggestions.map((s, i) => (
        <div
          key={i}
          className="card hscroll-item"
          style={{ textAlign: "left", cursor: "pointer" }}
          role="button"
          tabIndex={0}
          onClick={() => onPick(s)}
          onKeyDown={(e) => e.key === "Enter" && onPick(s)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <h3 style={{ fontSize: "1.05rem" }}>{s.title}</h3>
            <span className={`badge ${s.match === "have-everything" ? "badge-ok" : "badge-warn"}`}>
              {s.match === "have-everything" ? "✓ have it all" : `${s.missing.length} missing`}
            </span>
          </div>
          <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", margin: "6px 0" }}>{s.description}</p>
          <p style={{ color: "var(--text-faint)", fontSize: "0.78rem" }}>
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
          {onAddMissing && s.missing.length > 0 && (
            <button
              className="chip"
              style={{ marginTop: 10 }}
              onClick={(e) => {
                e.stopPropagation();
                onAddMissing(s);
              }}
            >
              🛒 Add {s.missing.length} missing to shopping list
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
