"use client";

import { useEffect, useRef, useState } from "react";

export default function StepTimer({ minutes }: { minutes: number }) {
  const total = Math.round(minutes * 60);
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);
  const finished = remaining === 0;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          try {
            navigator.vibrate?.([300, 100, 300, 100, 600]);
          } catch {}
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div
      className="card"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderColor: finished ? "var(--green-ok)" : running ? "var(--ember-500)" : "var(--border)",
      }}
    >
      <div>
        <span style={{ fontSize: "0.8rem", color: "var(--text-faint)" }}>TIMER</span>
        <p style={{ fontSize: "1.8rem", fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}>
          {finished ? "Done! ✓" : `${mm}:${ss}`}
        </p>
      </div>
      {!finished && (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setRunning((r) => !r)}>
            {running ? "Pause" : remaining === total ? `Start ${minutes} min` : "Resume"}
          </button>
          {remaining !== total && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                setRunning(false);
                setRemaining(total);
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
