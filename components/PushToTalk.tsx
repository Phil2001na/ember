"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

type State = "idle" | "recording" | "transcribing";

/** Safety net: stop a forgotten recording rather than uploading minutes of audio. */
const MAX_RECORDING_MS = 60_000;

const FALLBACK_HINT = "Voice input isn't working right now — try the mic on your keyboard instead.";

export default function PushToTalk({
  onTranscript,
  onError,
  disabled,
}: {
  onTranscript: (text: string) => void;
  /** Called when recording or transcription fails, so the caller can nudge toward the keyboard's own dictation mic. */
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    };
  }, []);

  async function start() {
    if (state !== "idle" || disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1500) {
          // too short to be speech
          setState("idle");
          return;
        }
        setState("transcribing");
        try {
          const form = new FormData();
          form.append("audio", new File([blob], "voice.webm", { type: mimeType }));
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (res.ok) {
            const { text } = await res.json();
            if (text) onTranscript(text);
            else onError?.(FALLBACK_HINT);
          } else {
            onError?.(FALLBACK_HINT);
          }
        } catch {
          onError?.(FALLBACK_HINT);
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
    } catch {
      setState("idle");
      onError?.("Couldn't reach the microphone — try the mic on your keyboard instead.");
    }
  }

  function stop() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      try {
        navigator.vibrate?.(20);
      } catch {}
    }
  }

  const recording = state === "recording";

  return (
    <button
      type="button"
      className={`composer-btn ${recording ? "rec-live" : "composer-btn-ghost"}`}
      disabled={disabled || state === "transcribing"}
      onClick={recording ? stop : start}
      style={{
        transition: "background 0.15s, box-shadow 0.15s",
        ...(recording
          ? {
              background: "linear-gradient(180deg, #ef7263, var(--red-warn) 45%, #c74534)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 20px -6px rgba(226,96,79,0.6)",
            }
          : {}),
      }}
      aria-label={recording ? "Stop recording" : "Start talking"}
    >
      {state === "transcribing" ? (
        <span className="spinner" style={{ width: 16, height: 16 }} />
      ) : recording ? (
        <Square size={15} fill="currentColor" />
      ) : (
        <Mic size={19} />
      )}
    </button>
  );
}
