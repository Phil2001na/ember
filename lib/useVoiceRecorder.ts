"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "recording" | "transcribing";

/** Safety net: stop a forgotten recording rather than uploading minutes of audio. */
const MAX_RECORDING_MS = 60_000;

/* Hands-free tuning. The mic has to close itself — making you tap to stop
   defeats the whole point — so we watch the input level and end the turn on a
   pause. Thresholds are deliberately forgiving: a kitchen has an extractor fan
   and a sizzling pan in the background. */
const SILENCE_RMS = 0.025;
const SILENCE_HANG_MS = 1200; // quiet this long after speech ends the turn
const NO_SPEECH_MS = 7000; // nothing said at all — give up rather than sit open

export const MIC_FALLBACK_HINT =
  "Voice input isn't working right now — try the mic on your keyboard instead.";
export const MIC_DENIED_HINT =
  "Couldn't reach the microphone — try the mic on your keyboard instead.";

export function useVoiceRecorder({
  onTranscript,
  onError,
  onNoSpeech,
  hint,
}: {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  /** Auto-stop fired without hearing anything — the caller decides what that means. */
  onNoSpeech?: () => void;
  /** Vocabulary to bias transcription toward — ingredient names, command words. */
  hint?: string;
}) {
  const [state, setState] = useState<RecorderState>("idle");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vadRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const heardSpeechRef = useRef(false);
  const abandonedRef = useRef(false);

  // callbacks live in a ref so `start`/`stop` stay stable across renders
  const cbRef = useRef({ onTranscript, onError, onNoSpeech, hint });
  useEffect(() => {
    cbRef.current = { onTranscript, onError, onNoSpeech, hint };
  });

  const teardownVad = useCallback(() => {
    if (vadRef.current) {
      clearInterval(vadRef.current);
      vadRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    teardownVad();
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      try {
        navigator.vibrate?.(20);
      } catch {}
    }
  }, [teardownVad]);

  /** Stop without transcribing — used when the turn is abandoned (no speech, or barge-in). */
  const cancel = useCallback(() => {
    abandonedRef.current = true;
    stop();
  }, [stop]);

  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      teardownVad();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, [teardownVad]);

  /* Level-based voice activity detection: end the turn ~1.2s after they stop
     talking, or bail if they never started. */
  const attachVad = useCallback(
    (stream: MediaStream) => {
      try {
        const Ctx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new Ctx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);

        const buf = new Uint8Array(analyser.fftSize);
        const openedAt = Date.now();
        let quietSince: number | null = null;

        vadRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(buf);
          let sum = 0;
          for (const v of buf) {
            const x = (v - 128) / 128;
            sum += x * x;
          }
          const rms = Math.sqrt(sum / buf.length);
          const now = Date.now();

          if (rms > SILENCE_RMS) {
            heardSpeechRef.current = true;
            quietSince = null;
            return;
          }
          if (!heardSpeechRef.current) {
            if (now - openedAt > NO_SPEECH_MS) cancel();
            return;
          }
          quietSince ??= now;
          if (now - quietSince > SILENCE_HANG_MS) stop();
        }, 100);
      } catch {
        // no VAD available — the caller's tap-to-stop still works
      }
    },
    [cancel, stop]
  );

  /** `handsFree`: close the mic on a pause instead of waiting for a second tap. */
  const start = useCallback(
    async ({ handsFree = false }: { handsFree?: boolean } = {}) => {
      if (recorderRef.current?.state === "recording") return true;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
        const recorder = new MediaRecorder(stream, { mimeType });
        chunksRef.current = [];
        abandonedRef.current = false;
        heardSpeechRef.current = false;

        recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
        recorder.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          const abandoned = abandonedRef.current;
          const heard = heardSpeechRef.current;
          const blob = new Blob(chunksRef.current, { type: mimeType });

          if (abandoned) {
            setState("idle");
            if (!heard) cbRef.current.onNoSpeech?.();
            return;
          }
          if (blob.size < 1500) {
            // too short to be speech
            setState("idle");
            cbRef.current.onNoSpeech?.();
            return;
          }

          setState("transcribing");
          try {
            const form = new FormData();
            form.append("audio", new File([blob], "voice.webm", { type: mimeType }));
            if (cbRef.current.hint) form.append("prompt", cbRef.current.hint);
            const res = await fetch("/api/transcribe", { method: "POST", body: form });
            if (res.ok) {
              const { text } = await res.json();
              if (text) cbRef.current.onTranscript(text);
              else cbRef.current.onNoSpeech?.();
            } else {
              cbRef.current.onError?.(MIC_FALLBACK_HINT);
            }
          } catch {
            cbRef.current.onError?.(MIC_FALLBACK_HINT);
          } finally {
            setState("idle");
          }
        };

        recorderRef.current = recorder;
        recorder.start();
        setState("recording");
        autoStopRef.current = setTimeout(stop, MAX_RECORDING_MS);
        try {
          navigator.vibrate?.(30);
        } catch {}

        if (handsFree) attachVad(stream);
        return true;
      } catch {
        setState("idle");
        cbRef.current.onError?.(MIC_DENIED_HINT);
        return false;
      }
    },
    [attachVad, stop]
  );

  return { state, start, stop, cancel };
}
