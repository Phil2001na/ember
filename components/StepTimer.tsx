"use client";

import { Check } from "lucide-react";
import FireCanvas from "@/components/FireCanvas";
import type { CookTimer } from "@/lib/useCookTimers";

export default function StepTimer({
  stepIdx,
  minutes,
  label,
  timer,
  onStart,
  onToggle,
  onReset,
}: {
  stepIdx: number;
  minutes: number;
  label: string;
  timer: CookTimer | undefined;
  onStart: (stepIdx: number, minutes: number, label: string) => void;
  onToggle: (stepIdx: number) => void;
  onReset: (stepIdx: number) => void;
}) {
  const total = Math.round(minutes * 60);
  const remaining = timer ? timer.remainingSec : total;
  const running = timer?.running ?? false;
  const finished = timer?.finished ?? false;
  const progress = timer && total > 0 ? 1 - remaining / total : 0;

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div
      className="card"
      style={{
        borderColor: finished ? "var(--green-ok)" : running ? "var(--ember-500)" : "var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>TIMER</span>
          <p style={{ fontSize: "1.8rem", fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: 8 }}>
            {finished ? (
              <>
                Done! <Check size={24} style={{ color: "var(--green-ok)" }} />
              </>
            ) : (
              `${mm}:${ss}`
            )}
          </p>
        </div>
        {!finished && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => (timer ? onToggle(stepIdx) : onStart(stepIdx, minutes, label))}
            >
              {timer ? (running ? "Pause" : "Resume") : `Start ${minutes} min`}
            </button>
            {timer && (
              <button className="btn btn-ghost" onClick={() => onReset(stepIdx)}>
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {timer && !finished && (
        <div className="fire-track-wrap">
          <div className="fire-track">
            <FireCanvas progress={progress} running={running} variant="track" />
          </div>
        </div>
      )}
    </div>
  );
}
