// Shared requestAnimationFrame ticker for the fire canvases: one rAF loop no
// matter how many flames are burning. Runs only while subscribers exist and
// suspends entirely while the tab is hidden.

type FireSubscriber = (timeSec: number, dtSec: number) => void;

const subscribers = new Set<FireSubscriber>();
let rafId: number | null = null;
let lastNow = 0;
let timeSec = 0;
let visListenerAttached = false;

function frame(now: number) {
  rafId = null;
  // clamp dt so a background-tab gap doesn't teleport the flames
  const dt = Math.min((now - lastNow) / 1000, 0.1);
  lastNow = now;
  timeSec += dt;
  for (const fn of subscribers) fn(timeSec, dt);
  if (subscribers.size) rafId = requestAnimationFrame(frame);
}

function startLoop() {
  if (rafId != null || document.hidden || !subscribers.size) return;
  lastNow = performance.now();
  rafId = requestAnimationFrame(frame);
}

function stopLoop() {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function onVisibility() {
  if (document.hidden) stopLoop();
  else startLoop();
}

export function subscribeFire(fn: FireSubscriber): () => void {
  subscribers.add(fn);
  if (!visListenerAttached) {
    document.addEventListener("visibilitychange", onVisibility);
    visListenerAttached = true;
  }
  startLoop();
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) {
      stopLoop();
      if (visListenerAttached) {
        document.removeEventListener("visibilitychange", onVisibility);
        visListenerAttached = false;
      }
    }
  };
}
