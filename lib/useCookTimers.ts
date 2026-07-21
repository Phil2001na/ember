"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CookTimer = {
  stepIdx: number;
  label: string;
  totalSec: number;
  running: boolean;
  finished: boolean;
  remainingSec: number;
};

type StoredTimer = {
  stepIdx: number;
  label: string;
  totalSec: number;
  running: boolean;
  finished: boolean;
  endAt: number | null; // epoch ms this timer hits zero at, while running
  pausedSec: number; // remaining seconds snapshot while paused/finished
};

function remainingOf(t: StoredTimer, now: number) {
  if (!t.running || t.endAt == null) return t.pausedSec;
  return Math.max(0, Math.round((t.endAt - now) / 1000));
}

async function notifyTimerDone(stepIdx: number, label: string, url?: string) {
  try {
    navigator.vibrate?.([300, 100, 300, 100, 600]);
  } catch {}
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const options: NotificationOptions = {
        body: `Step ${stepIdx + 1}: ${label}`,
        tag: `ember-timer-${stepIdx}`,
        icon: "/icon-192.png",
        data: { url: url ?? "/" },
      };
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification("⏱️ Timer done", options);
      } else {
        new Notification("⏱️ Timer done", options);
      }
    }
  } catch {}
}

// Shared timer state for a cook session, keyed by step index, so timers
// survive step navigation and several can run concurrently. When a storageKey
// is given, timers also survive a reload — long waits (proofing, baking) mean
// people leave and come back.
export function useCookTimers(storageKey?: string, notificationUrl?: string) {
  const [timers, setTimers] = useState<Record<number, StoredTimer>>(() => {
    if (!storageKey || typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "{}");
    } catch {
      return {};
    }
  });
  const [now, setNow] = useState(() => Date.now());
  const notifiedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (Object.keys(timers).length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(timers));
    } catch {}
  }, [timers, storageKey]);

  const anyRunning = Object.values(timers).some((t) => t.running);

  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [anyRunning]);

  // flip running timers to finished once their end time has passed, and fire
  // the notification/vibration exactly once per timer
  useEffect(() => {
    setTimers((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const t of Object.values(prev)) {
        if (t.running && remainingOf(t, now) <= 0) {
          next[t.stepIdx] = { ...t, running: false, finished: true, endAt: null, pausedSec: 0 };
          changed = true;
          if (!notifiedRef.current.has(t.stepIdx)) {
            notifiedRef.current.add(t.stepIdx);
            void notifyTimerDone(t.stepIdx, t.label, notificationUrl);
          }
        }
      }
      return changed ? next : prev;
    });
  }, [now, notificationUrl]);

  const start = useCallback((stepIdx: number, minutes: number, label: string) => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission();
      }
    } catch {}
    notifiedRef.current.delete(stepIdx);
    const totalSec = Math.round(minutes * 60);
    setTimers((prev) => ({
      ...prev,
      [stepIdx]: {
        stepIdx,
        label,
        totalSec,
        running: true,
        finished: false,
        endAt: Date.now() + totalSec * 1000,
        pausedSec: totalSec,
      },
    }));
    setNow(Date.now());
  }, []);

  const toggle = useCallback((stepIdx: number) => {
    setTimers((prev) => {
      const t = prev[stepIdx];
      if (!t || t.finished) return prev;
      const n = Date.now();
      if (t.running) {
        return { ...prev, [stepIdx]: { ...t, running: false, endAt: null, pausedSec: remainingOf(t, n) } };
      }
      return { ...prev, [stepIdx]: { ...t, running: true, endAt: n + t.pausedSec * 1000 } };
    });
    setNow(Date.now());
  }, []);

  // resets/dismisses a timer back to "not started" (used by both the
  // per-step Reset button and the floating bar's dismiss action)
  const remove = useCallback((stepIdx: number) => {
    notifiedRef.current.delete(stepIdx);
    setTimers((prev) => {
      if (!(stepIdx in prev)) return prev;
      const next = { ...prev };
      delete next[stepIdx];
      return next;
    });
  }, []);

  const list: CookTimer[] = Object.values(timers)
    .map((t) => ({
      stepIdx: t.stepIdx,
      label: t.label,
      totalSec: t.totalSec,
      running: t.running,
      finished: t.finished,
      remainingSec: remainingOf(t, now),
    }))
    .sort((a, b) => a.stepIdx - b.stepIdx);

  return { timers: list, start, toggle, reset: remove };
}
