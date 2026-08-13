"use client";

/* Spoken output for voice mode. Browser `speechSynthesis` rather than a TTS
   API: it's free, works offline, and needs no round-trip — which matters more
   than voice quality when the whole point is to answer before the pan burns.
   Swapping in real TTS later only means reimplementing `speak`. */

export function speechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/* Every call to `speak`/`cancelSpeech` bumps this. `onEnd` callbacks check the
   generation they were queued under before firing, because cancelling an
   utterance fires `onend` (or `onerror`) on some platforms and would otherwise
   re-open the mic for a turn we already abandoned. */
let generation = 0;

let unlocked = false;

/** iOS won't speak later unless it has spoken once inside a user gesture. */
export function unlockSpeech() {
  if (unlocked || !speechSupported()) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {}
}

export function cancelSpeech() {
  generation += 1;
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}

/* One utterance per sentence: iOS truncates long ones, and short utterances
   mean a barge-in cancel lands almost immediately instead of at the end of a
   paragraph. */
function chunk(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .flatMap((s) => (s.length <= 180 ? [s] : s.split(/(?<=,)\s+/)))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function speak(text: string, opts?: { rate?: number; onEnd?: () => void }) {
  const done = opts?.onEnd;
  if (!speechSupported()) return void done?.();

  const parts = chunk(text);
  if (!parts.length) return void done?.();

  cancelSpeech();
  const mine = generation;
  const fire = () => {
    if (mine === generation) done?.();
  };

  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    u.rate = opts?.rate ?? 1.05;
    if (i === parts.length - 1) {
      u.onend = fire;
      u.onerror = fire;
    }
    try {
      window.speechSynthesis.speak(u);
    } catch {
      fire();
    }
  });
}
