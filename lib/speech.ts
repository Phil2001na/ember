"use client";

/* OpenAI TTS for Ember's primary voice, with browser speech as the resilient
   fallback. Sentences are fetched separately: the next one can generate while
   the current one plays, repeats are served from memory, and barge-in can stop
   promptly without waiting for a paragraph-sized audio file. */

export function speechSupported() {
  return (
    typeof window !== "undefined" &&
    (typeof Audio !== "undefined" || "speechSynthesis" in window)
  );
}

/* Every call to `speak`/`cancelSpeech` bumps this. Async work checks the
   generation before playing or firing onEnd, so a cancelled turn cannot talk
   over the cook or re-open the microphone. */
let generation = 0;

let unlocked = false;
let audio: HTMLAudioElement | null = null;
let request: AbortController | null = null;
let stopPlayback: (() => void) | null = null;

const MAX_CACHE_ITEMS = 40;
const audioCache = new Map<string, Blob>();
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAA=";

function audioElement() {
  if (!audio && typeof Audio !== "undefined") {
    audio = new Audio();
    audio.preload = "auto";
  }
  return audio;
}

/** Unlock generated audio and the device fallback inside a user gesture. */
export function unlockSpeech() {
  if (unlocked || !speechSupported()) return;
  unlocked = true;

  // Reuse this element later. Mobile Safari is much more willing to play
  // asynchronous audio after it has played once inside the user's tap.
  try {
    const player = audioElement();
    if (player) {
      player.src = SILENT_WAV;
      void player.play().then(() => player.pause()).catch(() => {});
    }
  } catch {}

  if (!("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(" ");
    utterance.volume = 0;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

export function cancelSpeech() {
  generation += 1;
  request?.abort();
  request = null;
  stopPlayback?.();
  stopPlayback = null;

  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {}
}

/* Short chunks improve first playback and make a barge-in stop quickly. */
function chunk(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .flatMap((sentence) =>
      sentence.length <= 180 ? [sentence] : sentence.split(/(?<=,)\s+/)
    )
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

async function generatedAudio(text: string, signal: AbortSignal) {
  const cached = audioCache.get(text);
  if (cached) {
    // Refresh insertion order so repeated instructions remain cached.
    audioCache.delete(text);
    audioCache.set(text, cached);
    return cached;
  }

  const response = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!response.ok) throw new Error("speech generation failed");

  const blob = await response.blob();
  if (!blob.size) throw new Error("empty speech response");
  audioCache.set(text, blob);
  if (audioCache.size > MAX_CACHE_ITEMS) {
    const oldest = audioCache.keys().next().value;
    if (oldest) audioCache.delete(oldest);
  }
  return blob;
}

function playAudio(blob: Blob, rate: number, mine: number) {
  return new Promise<void>((resolve, reject) => {
    const player = audioElement();
    if (!player || mine !== generation) return resolve();

    const url = URL.createObjectURL(blob);
    let settled = false;
    const clean = () => {
      player.onended = null;
      player.onerror = null;
      URL.revokeObjectURL(url);
      if (stopPlayback === stop) stopPlayback = null;
    };
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clean();
      if (error) reject(error);
      else resolve();
    };
    const stop = () => finish();
    stopPlayback = stop;
    player.src = url;
    player.playbackRate = rate;
    player.onended = () => finish();
    player.onerror = () => finish(new Error("audio playback failed"));
    void player.play().catch(finish);
  });
}

function audioResult(text: string, signal: AbortSignal) {
  return generatedAudio(text, signal).then(
    (blob) => ({ blob, error: null }),
    (error: unknown) => ({ blob: null, error })
  );
}

function speakWithDeviceVoice(
  parts: string[],
  rate: number,
  mine: number,
  done?: () => void
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (mine === generation) done?.();
    return;
  }

  parts.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    utterance.rate = rate;
    if (index === parts.length - 1) {
      const finish = () => {
        if (mine === generation) done?.();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
    }
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      if (index === parts.length - 1 && mine === generation) done?.();
    }
  });
}

export function speak(text: string, opts?: { rate?: number; onEnd?: () => void }) {
  const done = opts?.onEnd;
  if (!speechSupported()) return void done?.();

  const parts = chunk(text);
  if (!parts.length) return void done?.();

  cancelSpeech();
  const mine = generation;
  const rate = opts?.rate ?? 1.05;
  const controller = new AbortController();
  request = controller;

  void (async () => {
    let index = 0;
    try {
      // Fetch one sentence ahead to hide later generation behind playback
      // without paying to generate an entire interrupted answer.
      let next = audioResult(parts[0], controller.signal);
      for (; index < parts.length; index += 1) {
        const result = await next;
        if (result.error || !result.blob) throw result.error;
        const blob = result.blob;
        if (mine !== generation) return;
        next =
          index + 1 < parts.length
            ? audioResult(parts[index + 1], controller.signal)
            : Promise.resolve({ blob, error: null });
        await playAudio(blob, rate, mine);
      }
      if (mine === generation) done?.();
    } catch {
      if (mine !== generation || controller.signal.aborted) return;
      // Network/API/autoplay failures must not make hands-free cooking silent.
      speakWithDeviceVoice(parts.slice(index), rate, mine, done);
    } finally {
      if (request === controller) request = null;
    }
  })();
}
