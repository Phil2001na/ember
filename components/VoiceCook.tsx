"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Ear, Mic, Volume2, X } from "lucide-react";
import type { Recipe } from "@/lib/schemas";
import type { CookTimer } from "@/lib/useCookTimers";
import { useVoiceRecorder } from "@/lib/useVoiceRecorder";
import { cancelSpeech, speak, unlockSpeech } from "@/lib/speech";
import { parseVoiceCommand } from "@/lib/voiceCommands";
import {
  gateFor,
  narrateIngredients,
  narrateStep,
  narrateTimeLeft,
  narrateTimerDone,
  spokenDuration,
  transcriptionHint,
  type Gate,
} from "@/lib/cookNarration";

type Phase = "idle" | "speaking" | "listening" | "thinking";

const PHASE_HINT: Record<Phase, string> = {
  idle: "tap to talk",
  speaking: "Ember's talking — tap to cut in",
  listening: "listening…",
  thinking: "thinking…",
};

export default function VoiceCook({
  recipe,
  stepIdx,
  timers,
  busy,
  reply,
  onAsk,
  onNext,
  onPrev,
  onStartTimer,
  onToggleTimer,
  onFinish,
  onReadMode,
  onExit,
}: {
  recipe: Recipe;
  stepIdx: number;
  timers: CookTimer[];
  /** the model is mid-turn */
  busy: boolean;
  /** latest assistant text, so voice mode can read it out */
  reply: { id: string; text: string } | null;
  onAsk: (text: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onStartTimer: (stepIdx: number, minutes: number, label: string) => void;
  onToggleTimer: (stepIdx: number) => void;
  onFinish: () => void;
  onReadMode: () => void;
  onExit: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const step = recipe.steps[Math.min(stepIdx, recipe.steps.length - 1)];
  const isLast = stepIdx === recipe.steps.length - 1;
  const timer = timers.find((t) => t.stepIdx === stepIdx);
  // derived, not state: what we're waiting for is a pure function of the step
  const gate: Gate | null = step ? gateFor(step) : null;

  /* `narratedRef` is what stops voice mode from talking over itself: a step is
     narrated once, and a model reply counts as having covered whatever step it
     left us on (it will have said so itself). */
  const narratedRef = useRef("");
  // seeded with whatever was already on screen, so entering hands-free
  // narrates the current step rather than re-reading an old chat answer
  const spokenReplyRef = useRef<string | null>(reply?.id ?? null);
  // likewise: don't announce a timer that already rang before we got here
  const announcedRef = useRef<Set<string>>(
    new Set(timers.filter((t) => t.finished).map((t) => `${t.stepIdx}:${t.label}`))
  );
  const stepKey = `${stepIdx}:${step?.instruction ?? ""}`;

  const recorder = useVoiceRecorder({
    hint: transcriptionHint(recipe),
    onTranscript: (text) => handle(text),
    onNoSpeech: () => setPhase("idle"),
    onError: (message) => {
      setNotice(message);
      setPhase("idle");
    },
  });
  const { start: startRecording, stop: stopRecording, cancel: cancelRecording } = recorder;

  const openMic = useCallback(async () => {
    // set optimistically so the narration effect doesn't fire in the gap while
    // getUserMedia resolves
    setPhase("listening");
    setNotice(null);
    const ok = await startRecording({ handsFree: true });
    if (!ok) setPhase("idle");
  }, [startRecording]);

  const say = useCallback(
    (text: string, listen: boolean) => {
      setPhase("speaking");
      speak(text, {
        onEnd: () => {
          if (listen) void openMic();
          else setPhase("idle");
        },
      });
    },
    [openMic]
  );

  const narrateCurrent = useCallback(() => {
    if (!step) return;
    narratedRef.current = stepKey;
    say(narrateStep(step, stepIdx, recipe.steps.length, gateFor(step)), true);
  }, [say, step, stepIdx, stepKey, recipe.steps.length]);

  useEffect(() => {
    unlockSpeech();
    return () => cancelSpeech();
  }, []);

  // narrate whenever we land on a step we haven't read out yet — covers both
  // entering voice mode and every later move, however it was triggered
  useEffect(() => {
    if (phase !== "idle" || busy) return;
    if (narratedRef.current === stepKey) return;
    narrateCurrent();
  }, [phase, busy, stepKey, narrateCurrent]);

  // read the model's answer aloud
  useEffect(() => {
    if (!reply || busy || reply.id === spokenReplyRef.current) return;
    spokenReplyRef.current = reply.id;
    // the reply will have described wherever its tool calls left us
    narratedRef.current = stepKey;
    say(reply.text, true);
  }, [reply, busy, say, stepKey]);

  // a timer running out is the other thing that gets to interrupt
  useEffect(() => {
    const done = timers.find((t) => t.finished && !announcedRef.current.has(`${t.stepIdx}:${t.label}`));
    if (!done) return;
    announcedRef.current.add(`${done.stepIdx}:${done.label}`);
    if (phase === "listening") cancelRecording();
    say(narrateTimerDone(recipe.steps[done.stepIdx], done.label), true);
  }, [timers, phase, cancelRecording, say, recipe.steps]);

  function handle(text: string) {
    setHeard(text);
    const command = parseVoiceCommand(text);

    if (!command) {
      setPhase("thinking");
      onAsk(text);
      return;
    }

    setPhase("idle");
    switch (command) {
      case "next":
        if (isLast) return onFinish();
        return onNext();
      case "back":
        return onPrev();
      case "repeat":
        return narrateCurrent();
      case "go":
        if (gate?.kind === "ready") {
          onStartTimer(stepIdx, gate.timerMin, step.instruction);
          // timer-gate: go quiet, mic closed, until it rings
          return say(`Started. ${spokenDuration(gate.timerMin)} on the clock.`, false);
        }
        return say("Nothing to time on this step. Say next when you're done.", true);
      case "pause":
        if (timer && !timer.finished && timer.running) {
          onToggleTimer(stepIdx);
          return say("Paused. Say resume when you're back.", false);
        }
        return say("No timer running right now.", true);
      case "resume":
        if (timer && !timer.finished && !timer.running) {
          onToggleTimer(stepIdx);
          return say("Running again.", false);
        }
        return say("Nothing to resume.", true);
      case "time_left": {
        const live = timer ?? timers.find((t) => t.running);
        if (!live) return say("No timer running. Say next when you're ready.", true);
        return say(narrateTimeLeft(live.remainingSec, live.label), true);
      }
      case "detail":
        return say(step?.detail || "That's all I've got on this one.", true);
      case "ingredients":
        return say(narrateIngredients(recipe), true);
      case "exit":
        cancelSpeech();
        return onExit();
    }
  }

  function tapOrb() {
    unlockSpeech();
    if (phase === "speaking") {
      cancelSpeech();
      return void openMic();
    }
    if (phase === "listening") return stopRecording();
    if (phase === "idle") return void openMic();
  }

  const displayPhase: Phase = busy || recorder.state === "transcribing" ? "thinking" : phase;
  // while a timer runs the mic is deliberately shut — say so, rather than
  // leaving a "say go" prompt up for a clock that's already going
  const idleHint = timer?.running
    ? "timer running — I'll speak up when it's done"
    : (gate?.hint ?? PHASE_HINT.idle);
  const mm = timer ? Math.floor(timer.remainingSec / 60) : 0;
  const ss = timer ? String(timer.remainingSec % 60).padStart(2, "0") : "00";

  return (
    <div className="voice-shell">
      <div className="voice-top">
        <button className="icon-btn" onClick={onReadMode} aria-label="Switch to read mode">
          <BookOpen size={19} />
        </button>
        <span className="badge badge-outline">
          {stepIdx + 1} / {recipe.steps.length}
        </span>
        {timer && !timer.finished ? (
          <span className={`voice-timer ${timer.running ? "live" : ""}`}>
            {mm}:{ss}
          </span>
        ) : (
          <span className="voice-timer-placeholder" />
        )}
        <button className="icon-btn" onClick={onExit} aria-label="Leave voice mode">
          <X size={19} />
        </button>
      </div>

      <div className="voice-body">
        <p className="voice-instruction">{step?.instruction}</p>
        {step?.watch_for && <p className="voice-watch">Watch for {step.watch_for}</p>}
      </div>

      <div className="voice-controls">
        <button
          type="button"
          className={`voice-orb voice-orb-${displayPhase}`}
          onClick={tapOrb}
          aria-label={PHASE_HINT[displayPhase]}
        >
          {displayPhase === "speaking" ? (
            <Volume2 size={34} />
          ) : displayPhase === "thinking" ? (
            <span className="spinner" style={{ width: 30, height: 30 }} />
          ) : displayPhase === "listening" ? (
            <Ear size={34} />
          ) : (
            <Mic size={34} />
          )}
        </button>

        <p className="voice-gate">
          {notice ?? (displayPhase === "idle" ? idleHint : PHASE_HINT[displayPhase])}
        </p>
        <p className="voice-disclosure">Ember&apos;s voice is AI-generated.</p>
        {heard && <p className="voice-heard">“{heard}”</p>}
      </div>
    </div>
  );
}
