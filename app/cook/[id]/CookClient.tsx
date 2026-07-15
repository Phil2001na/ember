"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/client";
import { applyAmendment } from "@/lib/recipe";
import type { Recipe, RecipeStep } from "@/lib/schemas";
import StepTimer from "@/components/StepTimer";
import TimerBar from "@/components/TimerBar";
import ChatDrawer from "@/components/ChatDrawer";
import PushToTalk from "@/components/PushToTalk";
import { useCookTimers } from "@/lib/useCookTimers";

const HEAT_LABEL: Record<string, string> = {
  off: "heat off",
  low: "low heat",
  "medium-low": "medium-low",
  medium: "medium heat",
  "medium-high": "medium-high",
  high: "high heat",
};

export default function CookClient({
  sessionId,
  initialRecipe,
  initialMessages,
  initialStep,
  initialStatus,
}: {
  sessionId: string;
  initialRecipe: Recipe;
  initialMessages: UIMessage[];
  initialStep: number;
  initialStatus: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [recipe, setRecipe] = useState(initialRecipe);
  const [stepIdx, setStepIdx] = useState(Math.min(initialStep, initialRecipe.steps.length - 1));
  const [done, setDone] = useState(initialStatus === "completed");
  const [chatOpen, setChatOpen] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  // post-cook pantry check: null = not checked, [] = nothing to remove
  const [usedUp, setUsedUp] = useState<string[] | null>(null);
  const [usedUpChecking, setUsedUpChecking] = useState(false);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [pantryUpdated, setPantryUpdated] = useState(false);
  const speakRepliesRef = useRef(speakReplies);
  speakRepliesRef.current = speakReplies;
  const spokenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const appliedTools = useRef<Set<string>>(new Set());
  const stepRef = useRef(stepIdx);
  stepRef.current = stepIdx;
  const cookTimers = useCookTimers();

  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/cook",
      body: () => ({ sessionId, currentStep: stepRef.current }),
    }),
  });

  // keep the screen awake while cooking
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    async function acquire() {
      try {
        lock = await navigator.wakeLock?.request("screen");
      } catch {}
    }
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  // apply recipe amendments arriving via the amend_recipe tool
  useEffect(() => {
    for (const m of messages) {
      for (const part of m.parts) {
        if (
          part.type === "tool-amend_recipe" &&
          "input" in part &&
          part.input &&
          !appliedTools.current.has(part.toolCallId) &&
          (part.state === "output-available" || part.state === "input-available")
        ) {
          appliedTools.current.add(part.toolCallId);
          const input = part.input as { remaining_steps: RecipeStep[] };
          if (input.remaining_steps?.length) {
            setRecipe((r) => applyAmendment(r, input.remaining_steps));
          }
        }
      }
    }
  }, [messages]);

  // speak finished replies aloud when voice mode is on
  useEffect(() => {
    if (status !== "ready" || !speakRepliesRef.current) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || spokenIds.current.has(last.id)) return;
    spokenIds.current.add(last.id);
    const text = last.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join(" ");
    if (text && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  }, [status, messages]);

  // persist chat after each completed exchange
  const lastSaved = useRef(initialMessages.length);
  useEffect(() => {
    if (status === "ready" && messages.length > lastSaved.current) {
      lastSaved.current = messages.length;
      supabase
        .from("cook_sessions")
        .update({ messages })
        .eq("id", sessionId)
        .then(() => {});
    }
  }, [status, messages, sessionId, supabase]);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, recipe.steps.length - 1));
      setStepIdx(clamped);
      supabase
        .from("cook_sessions")
        .update({ current_step: clamped })
        .eq("id", sessionId)
        .then(() => {});
    },
    [recipe.steps.length, sessionId, supabase]
  );

  async function finish() {
    setDone(true);
    setUsedUpChecking(true);
    supabase
      .from("cook_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .then(() => {});
    try {
      const res = await fetch("/api/used-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const { used_up } = await res.json();
        setUsedUp(used_up ?? []);
      } else {
        setUsedUp([]);
      }
    } catch {
      setUsedUp([]);
    } finally {
      setUsedUpChecking(false);
    }
  }

  async function updatePantry() {
    if (!usedUp) return;
    const names = usedUp.filter((n) => !deselected.has(n));
    setPantryUpdated(true);
    if (!names.length) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase
      .from("pantry_items")
      .delete()
      .eq("user_id", user!.id)
      .in("name", names);
  }

  async function saveRecipe() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("saved_recipes")
      .insert({ user_id: user!.id, recipe });
    setSaving(false);
    if (!error) setSaved(true);
  }

  if (done) {
    return (
      <main className="page fade-in" style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", minHeight: "100dvh", paddingBottom: 40 }}>
        <div style={{ fontSize: "4rem", marginBottom: 8 }}>🔥</div>
        <h1 className="title-glow" style={{ fontSize: "2rem", marginBottom: 8 }}>You made it.</h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 28 }}>
          {recipe.title} — cooked by you, coached by Ember.
        </p>

        {usedUpChecking && (
          <p style={{ color: "var(--text-faint)", fontSize: "0.85rem", marginBottom: 20, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
            <span className="spinner" style={{ width: 14, height: 14 }} /> checking your pantry…
          </p>
        )}

        {!pantryUpdated && usedUp && usedUp.length > 0 && (
          <div className="card fade-in" style={{ textAlign: "left", marginBottom: 20, borderColor: "var(--ember-500)" }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: 4 }}>🧺 Pantry check</h3>
            <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginBottom: 12 }}>
              Looks like this cook finished these off — tap any you still have.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {usedUp.map((name) => {
                const off = deselected.has(name);
                return (
                  <button
                    key={name}
                    className={`chip ${off ? "" : "selected"}`}
                    style={off ? { opacity: 0.4, textDecoration: "line-through" } : undefined}
                    onClick={() =>
                      setDeselected((prev) => {
                        const next = new Set(prev);
                        if (next.has(name)) next.delete(name);
                        else next.add(name);
                        return next;
                      })
                    }
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={updatePantry}>
                Update pantry
              </button>
              <button className="btn btn-ghost" onClick={() => setPantryUpdated(true)}>
                Skip
              </button>
            </div>
          </div>
        )}
        {pantryUpdated && usedUp && usedUp.length > 0 && (
          <p style={{ color: "var(--text-faint)", fontSize: "0.85rem", marginBottom: 20 }}>
            ✓ Pantry sorted.
          </p>
        )}

        <button
          className="btn btn-ghost btn-full"
          style={{ marginBottom: 12 }}
          onClick={saveRecipe}
          disabled={saving || saved}
        >
          {saved ? "✓ Saved to your recipes" : saving ? <span className="spinner" /> : "📖 Save this recipe"}
        </button>
        <button className="btn btn-primary btn-full" onClick={() => router.push("/")}>
          Back home
        </button>
      </main>
    );
  }

  const step = recipe.steps[stepIdx];
  const isLast = stepIdx === recipe.steps.length - 1;

  return (
    <main
      className="page"
      style={{
        paddingBottom: 120,
        paddingTop: cookTimers.timers.length ? 64 : undefined,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <TimerBar
        timers={cookTimers.timers}
        currentStepIdx={stepIdx}
        onJump={goTo}
        onToggle={cookTimers.toggle}
        onDismiss={cookTimers.reset}
      />

      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <button onClick={() => router.push("/")} style={{ color: "var(--text-faint)", fontSize: "0.85rem" }}>
          ← pause
        </button>
        <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{recipe.title}</span>
        <span className="badge badge-accent">
          {stepIdx + 1} / {recipe.steps.length}
        </span>
      </div>

      {/* progress bar */}
      <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 2, marginBottom: 22 }}>
        <div
          style={{
            height: "100%",
            width: `${((stepIdx + 1) / recipe.steps.length) * 100}%`,
            background: "linear-gradient(90deg, var(--ember-500), var(--amber-400))",
            borderRadius: 2,
            boxShadow: "0 0 10px rgba(240, 118, 43, 0.55)",
            transition: "width 0.3s",
          }}
        />
      </div>

      {/* the step */}
      <div className="fade-in" key={`${stepIdx}-${step.instruction.slice(0, 24)}`} style={{ flex: 1 }}>
        {step.heat && (
          <span className={`badge ${step.heat === "high" || step.heat === "medium-high" ? "badge-warn" : "badge-accent"}`} style={{ marginBottom: 12 }}>
            🔥 {HEAT_LABEL[step.heat]}
          </span>
        )}
        <h2 style={{ fontSize: "1.55rem", lineHeight: 1.25, margin: "10px 0 14px" }}>
          {step.instruction}
        </h2>
        <p style={{ color: "var(--text-dim)", fontSize: "1rem", marginBottom: 16 }}>{step.detail}</p>

        {step.watch_for && (
          <div className="card" style={{ borderColor: "var(--amber-400)", background: "rgba(245,185,66,0.06)", marginBottom: 16, padding: "12px 14px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--amber-300)" }}>WATCH FOR</span>
            <p style={{ fontSize: "0.92rem" }}>{step.watch_for}</p>
          </div>
        )}

        {step.timer_min && (
          <StepTimer
            stepIdx={stepIdx}
            minutes={step.timer_min}
            label={step.instruction}
            timer={cookTimers.timers.find((t) => t.stepIdx === stepIdx)}
            onStart={cookTimers.start}
            onToggle={cookTimers.toggle}
            onReset={cookTimers.reset}
          />
        )}
      </div>

      {/* nav */}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={() => goTo(stepIdx - 1)} disabled={stepIdx === 0} style={{ flex: 1 }}>
          Back
        </button>
        {isLast ? (
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={finish}>
            Done — I cooked it 🔥
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => goTo(stepIdx + 1)}>
            Next step
          </button>
        )}
      </div>

      {/* chat handle */}
      <button
        className="btn btn-ghost btn-full"
        style={{ marginTop: 10, borderStyle: "dashed" }}
        onClick={() => setChatOpen(true)}
      >
        💬 Ask Ember anything
      </button>

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        messages={messages}
        sendMessage={(text) => sendMessage({ text })}
        busy={status === "submitted" || status === "streaming"}
        extraControls={
          <>
            <PushToTalk
              disabled={status === "submitted" || status === "streaming"}
              onTranscript={(text) => {
                setSpeakReplies(true);
                sendMessage({ text });
              }}
            />
            <button
              type="button"
              className="composer-btn composer-btn-ghost"
              style={{ opacity: speakReplies ? 1 : 0.45 }}
              onClick={() => {
                setSpeakReplies((s) => {
                  if (s) window.speechSynthesis?.cancel();
                  return !s;
                });
              }}
              aria-label={speakReplies ? "Mute spoken replies" : "Speak replies aloud"}
            >
              {speakReplies ? "🔊" : "🔇"}
            </button>
          </>
        }
      />
    </main>
  );
}
