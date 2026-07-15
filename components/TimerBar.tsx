"use client";

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

  return (
    <div className="timer-bar-wrap">
      <div className="timer-bar">
        {timers.map((t) => {
          const mm = Math.floor(t.remainingSec / 60);
          const ss = String(t.remainingSec % 60).padStart(2, "0");
          const here = t.stepIdx === currentStepIdx;
          return (
            <div
              key={t.stepIdx}
              className={`timer-chip ${t.finished ? "timer-chip-done" : t.running ? "timer-chip-running" : "timer-chip-paused"}`}
            >
              <button
                className="timer-chip-main"
                onClick={() => onJump(t.stepIdx)}
                aria-label={`Jump to step ${t.stepIdx + 1}`}
              >
                <span className="timer-chip-step">Step {t.stepIdx + 1}{here ? " · here" : ""}</span>
                <span className="timer-chip-time">{t.finished ? "Done! ✓" : `${mm}:${ss}`}</span>
              </button>
              <div className="timer-chip-actions">
                {!t.finished && (
                  <button
                    type="button"
                    className="timer-chip-icon-btn"
                    onClick={() => onToggle(t.stepIdx)}
                    aria-label={t.running ? "Pause timer" : "Resume timer"}
                  >
                    {t.running ? "⏸" : "▶"}
                  </button>
                )}
                <button
                  type="button"
                  className="timer-chip-icon-btn"
                  onClick={() => onDismiss(t.stepIdx)}
                  aria-label="Dismiss timer"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
