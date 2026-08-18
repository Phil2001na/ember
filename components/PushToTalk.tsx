"use client";

import { Mic, Square } from "lucide-react";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";
import { unlockSpeech } from "@/lib/speech";

export default function PushToTalk({
  onTranscript,
  onError,
  disabled,
  hint,
}: {
  onTranscript: (text: string) => void;
  /** Called when recording or transcription fails, so the caller can nudge toward the keyboard's own dictation mic. */
  onError?: (message: string) => void;
  disabled?: boolean;
  /** Vocabulary to bias transcription toward — e.g. the recipe being cooked. */
  hint?: string;
}) {
  const { state, start, stop } = useVoiceRecorder({ onTranscript, onError, hint });

  const recording = state === "recording";

  return (
    <button
      type="button"
      className={`composer-btn ${recording ? "rec-live" : "composer-btn-ghost"}`}
      disabled={disabled || state === "transcribing"}
      onClick={() => {
        if (recording) return stop();
        // The eventual spoken reply arrives asynchronously, so unlock its
        // audio element now while this user gesture is still active.
        unlockSpeech();
        void start();
      }}
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
