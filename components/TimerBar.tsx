"use client";

import { Check, Pause, Play, X } from "lucide-react";
import FireCanvas from "@/components/FireCanvas";
import type { CookTimer } from "@/lib/useCookTimers";

export default function TimerBar({
  timers,
  currentStepIdx,
  onJump,
  onToggle,
  onDismiss,
}: {
  timers: CookTimer[];
  currentStepIdx: number;
  onJump: (stepIdx: number) => void;
  onToggle: (stepIdx: number) => void;
  onDismiss: (stepIdx: number) => void;
}) {
  if (!timers.length) return null;

  const doneLabels = timers.filter((t) => t.finished).map((t) => t.label);

  return (
    <div className="timer-bar-wrap">
      <span className="sr-only" role="status" aria-live="polite">
        {doneLabels.length ? `Timer done: ${doneLabels.join(", ")}` : ""}
      </span>
      <div className="timer-bar">
        {timers.map((t) => {
          const mm = Math.floor(t.remainingSec / 60);
          const ss = String(t.remainingSec % 60).padStart(2, "0");
          const here = t.stepIdx === currentStepIdx;
          const progress = t.totalSec > 0 ? 1 - t.remainingSec / t.totalSec : 0;
          return (
            <div
              key={t.stepIdx}
              className={`timer-chip ${t.finished ? "timer-chip-done" : t.running ? "timer-chip-running" : "timer-chip-paused"}`}
            >
              {!t.finished && (
                <div className="timer-chip-fire">
                  <FireCanvas progress={progress} running={t.running} variant="chip" />
                </div>
              )}
              <button
                className="timer-chip-main"
                onClick={() => onJump(t.stepIdx)}
                title={t.label}
                aria-label={`Jump to step ${t.stepIdx + 1}: ${t.label}`}
              >
                <span className="timer-chip-step">
                  <span className="timer-chip-label">{t.label}</span>
                  {here ? " · here" : ""}
                </span>
                <span className="timer-chip-time" style={t.finished ? { display: "inline-flex", alignItems: "center", gap: 4 } : undefined}>
                  {t.finished ? (
                    <>
                      Done! <Check size={13} />
                    </>
                  ) : (
                    `${mm}:${ss}`
                  )}
                </span>
              </button>
              <div className="timer-chip-actions">
                {!t.finished && (
                  <button
                    type="button"
                    className="timer-chip-icon-btn"
                    onClick={() => onToggle(t.stepIdx)}
                    aria-label={t.running ? "Pause timer" : "Resume timer"}
                  >
                    {t.running ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                )}
                <button
                  type="button"
                  className="timer-chip-icon-btn"
                  onClick={() => onDismiss(t.stepIdx)}
                  aria-label="Dismiss timer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
