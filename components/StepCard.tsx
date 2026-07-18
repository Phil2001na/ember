"use client";

import { Check, CookingPot, Eye } from "lucide-react";
import FireCanvas from "@/components/FireCanvas";
import HeatDial from "@/components/HeatDial";
import type { RecipeStep } from "@/lib/schemas";
import type { CookTimer } from "@/lib/useCookTimers";

const HEAT_LABEL: Record<string, string> = {
  off: "heat off",
  low: "low heat",
  "medium-low": "medium-low",
  medium: "medium heat",
  "medium-high": "medium-high",
  high: "high heat",
};

export default function StepCard({
  stepIdx,
  step,
  timer,
  onStart,
  onToggle,
  onReset,
}: {
  stepIdx: number;
  step: RecipeStep;
  timer: CookTimer | undefined;
  onStart: (stepIdx: number, minutes: number, label: string) => void;
  onToggle: (stepIdx: number) => void;
  onReset: (stepIdx: number) => void;
}) {
  const hasTimer = !!step.timer_min;
  const total = hasTimer ? Math.round(step.timer_min! * 60) : 0;
  const remaining = timer ? timer.remainingSec : total;
  const running = timer?.running ?? false;
  const finished = timer?.finished ?? false;
  const progress = timer && total > 0 ? 1 - remaining / total : 0;
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const showBottom = !!step.watch_for || (hasTimer && !finished);

  return (
    <div
      className="card step-card"
      style={{ borderColor: finished ? "var(--green-ok)" : running ? "var(--ember-500)" : "var(--border)" }}
    >
      <div className="step-card-label">
        <CookingPot size={15} /> Active step
      </div>

      <div className="step-card-top">
        <div className="step-card-main">
          <h2 className="step-card-instruction">{step.instruction}</h2>
          {hasTimer && (
            <p className="step-card-remaining">
              {finished ? (
                <span style={{ color: "var(--green-ok)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  Done! <Check size={20} />
                </span>
              ) : (
                <>
                  {mm}:{ss} <span>remaining</span>
                </>
              )}
            </p>
          )}
        </div>
        {step.heat && <HeatDial heat={step.heat} label={HEAT_LABEL[step.heat]} active={running} />}
      </div>

      {hasTimer && !finished && (
        <>
          <div className="step-card-rule" />
          <span className="step-card-sublabel">Progress</span>
          <div className="fire-track-wrap">
            <div className="fire-track">
              <FireCanvas progress={progress} running={running} variant="track" />
            </div>
          </div>
          <div className="fire-track-scale">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </>
      )}

      {showBottom && (
        <>
          <div className="step-card-rule" />
          <div className="step-card-bottom">
            {step.watch_for && (
              <div className="step-card-watch">
                <div className="step-card-watch-title">
                  <Eye size={15} /> Watch for
                </div>
                <p>{step.watch_for}</p>
              </div>
            )}
            {hasTimer && !finished && (
              <div className="step-card-controls">
                <button
                  className="btn btn-primary"
                  onClick={() => (timer ? onToggle(stepIdx) : onStart(stepIdx, step.timer_min!, step.instruction))}
                >
                  {timer ? (running ? "Pause" : "Resume") : `Start ${step.timer_min} min`}
                </button>
                {timer && (
                  <button className="btn btn-ghost" onClick={() => onReset(stepIdx)}>
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
