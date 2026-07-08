"use client";

import { useRef, useState } from "react";

type State = "idle" | "recording" | "transcribing";

export default function PushToTalk({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
          }
        } finally {
          setState("idle");
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      try {
        navigator.vibrate?.(30);
      } catch {}
    } catch {
      setState("idle");
    }
  }

  function stop() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  return (
    <button
      type="button"
      className={`composer-btn ${state === "recording" ? "" : "composer-btn-ghost"}`}
      disabled={disabled || state === "transcribing"}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      style={{
        touchAction: "none",
        transition: "background 0.15s, box-shadow 0.15s",
        ...(state === "recording"
          ? {
              background: "linear-gradient(180deg, #ef7263, var(--red-warn) 45%, #c74534)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 20px -6px rgba(226,96,79,0.6)",
            }
          : {}),
      }}
      aria-label="Hold to talk"
    >
      {state === "transcribing" ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "🎤"}
    </button>
  );
}
