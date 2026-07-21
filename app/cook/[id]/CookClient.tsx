"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronRight,
  CircleCheck,
  Eye,
  Flame,
  Home,
  MessageCircle,
  Share2,
  ShoppingBasket,
  Volume2,
  VolumeX,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { applyAmendment } from "@/lib/recipe";
import type { Recipe, RecipeStep } from "@/lib/schemas";
import StepCard from "@/components/StepCard";
import TimerBar from "@/components/TimerBar";
import ChatDrawer from "@/components/ChatDrawer";
import PushToTalk from "@/components/PushToTalk";
import { useCookTimers } from "@/lib/useCookTimers";
import { shareSavedRecipe } from "@/lib/shareRecipe";
import { buildFitnessReturnUrl, inferMealOutcome } from "@/lib/fitnessHandoff";

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
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  // post-cook pantry check: null = not checked, [] = nothing to remove
  const [usedUp, setUsedUp] = useState<string[] | null>(null);
  const [usedUpChecking, setUsedUpChecking] = useState(false);
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [pantryUpdated, setPantryUpdated] = useState(false);
  const [fitnessRequestId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(`ember-fitness-request-${sessionId}`);
    } catch {
      return null;
    }
  });
  const [fitnessSent, setFitnessSent] = useState(false);
  const speakRepliesRef = useRef(speakReplies);
  speakRepliesRef.current = speakReplies;
  const spokenIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const appliedTools = useRef<Set<string>>(new Set());
  const stepRef = useRef(stepIdx);
  stepRef.current = stepIdx;
  const cookTimers = useCookTimers(`ember-timers-${sessionId}`, `/cook/${sessionId}`);

  function sendMealOutcome() {
    if (!fitnessRequestId) return;
    const url = buildFitnessReturnUrl(inferMealOutcome(recipe, fitnessRequestId));
    if (!url) return;
    setFitnessSent(true);
    try {
      localStorage.removeItem(`ember-fitness-request-${sessionId}`);
    } catch {}
    window.location.href = url;
  }

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

  // apply tool calls arriving in the chat stream (recipe amendments, timers)
  const startTimer = cookTimers.start;
  useEffect(() => {
    for (const m of messages) {
      for (const part of m.parts) {
        if (
          !("toolCallId" in part) ||
          !("input" in part) ||
          !part.input ||
          appliedTools.current.has(part.toolCallId) ||
          (part.state !== "output-available" && part.state !== "input-available")
        )
          continue;
        if (part.type === "tool-amend_recipe") {
          appliedTools.current.add(part.toolCallId);
          const input = part.input as { remaining_steps: RecipeStep[] };
          if (input.remaining_steps?.length) {
            setRecipe((r) => applyAmendment(r, input.remaining_steps));
          }
        } else if (part.type === "tool-start_timer") {
          appliedTools.current.add(part.toolCallId);
          const input = part.input as { minutes: number; label: string };
          if (input.minutes > 0) {
            startTimer(stepRef.current, input.minutes, input.label);
          }
        }
      }
    }
  }, [messages, startTimer]);

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
    try {
      localStorage.removeItem(`ember-timers-${sessionId}`);
    } catch {}
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
    const { data, error } = await supabase
      .from("saved_recipes")
      .insert({ user_id: user!.id, recipe })
      .select("id")
      .single();
    setSaving(false);
    if (!error && data) {
      setSaved(true);
      setSavedRecipeId(data.id);
    }
  }

  async function shareRecipe() {
    if (!savedRecipeId) return;
    setSharing(true);
    setShareNotice(null);
    try {
      const result = await shareSavedRecipe(savedRecipeId, recipe.title);
      setShareNotice(result === "copied" ? "Recipe link copied." : "Recipe shared.");
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setShareNotice("Couldn't share that recipe yet.");
      }
    } finally {
      setSharing(false);
    }
  }

  if (done) {
    return (
      <main className="page fade-in" style={{ display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center", minHeight: "100dvh", paddingBottom: 40 }}>
        <div style={{ fontSize: "4.4rem", marginBottom: 10 }}>🔥</div>
        <h1 style={{ fontSize: "2.4rem", marginBottom: 10 }}>
          You <span className="accent-serif">made it</span>.
        </h1>
        <p style={{ color: "var(--text-dim)", marginBottom: 28 }}>
          {recipe.title} — cooked by you, coached by Ember.
        </p>

        <div className="card row-card" style={{ marginBottom: 12 }}>
          <span className="row-card-icon">
            <CircleCheck />
          </span>
          <div>
            <h3>Great work!</h3>
            <p>Hope you enjoyed the process as much as the meal.</p>
          </div>
        </div>

        {usedUpChecking && (
          <p style={{ color: "var(--text-faint)", fontSize: "0.85rem", marginBottom: 20, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
            <span className="spinner" style={{ width: 14, height: 14 }} /> checking your pantry…
          </p>
        )}

        {!pantryUpdated && usedUp && usedUp.length > 0 && (
          <div className="card fade-in" style={{ textAlign: "left", marginBottom: 20, borderColor: "var(--ember-500)" }}>
            <h3 style={{ fontSize: "0.95rem", marginBottom: 4, fontFamily: "var(--font-ui)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <ShoppingBasket size={17} style={{ color: "var(--ember-400)" }} /> Pantry check
            </h3>
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
          <p style={{ color: "var(--text-faint)", fontSize: "0.85rem", marginBottom: 20, display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
            <Check size={15} style={{ color: "var(--green-ok)" }} /> Pantry sorted.
          </p>
        )}

        {fitnessRequestId && process.env.NEXT_PUBLIC_FITNESS_URL && (
          <button
            className="card row-card fade-in"
            style={{ marginBottom: 16, opacity: fitnessSent ? 0.75 : undefined }}
            onClick={sendMealOutcome}
            disabled={fitnessSent}
          >
            <span className="row-card-icon" style={fitnessSent ? { borderColor: "var(--green-ok)", color: "var(--green-ok)" } : undefined}>
              <Activity />
            </span>
            <div style={{ flex: 1 }}>
              <h3>{fitnessSent ? "Sent to Fitness" : "I ate this"}</h3>
              <p>{fitnessSent ? "Heading back over now" : "Let Fitness know without leaving details behind"}</p>
            </div>
            {!fitnessSent && <ChevronRight size={19} style={{ color: "var(--text-faint)" }} />}
          </button>
        )}

        <button
          className="card row-card"
          style={{ marginBottom: 16, opacity: saved ? 0.75 : undefined }}
          onClick={saveRecipe}
          disabled={saving || saved}
        >
          <span className="row-card-icon" style={saved ? { borderColor: "var(--green-ok)", color: "var(--green-ok)" } : undefined}>
            {saving ? <span className="spinner" style={{ width: 18, height: 18 }} /> : saved ? <BookmarkCheck /> : <Bookmark />}
          </span>
          <div style={{ flex: 1 }}>
            <h3>{saved ? "Saved to your recipes" : "Save this recipe"}</h3>
            <p>{saved ? "Find it under You → Saved recipes" : "Add it to your collection"}</p>
          </div>
          {!saved && <ChevronRight size={19} style={{ color: "var(--text-faint)" }} />}
        </button>
        {savedRecipeId && (
          <button
            className="card row-card fade-in"
            style={{ marginBottom: 16 }}
            onClick={shareRecipe}
            disabled={sharing}
          >
            <span className="row-card-icon">
              {sharing ? <span className="spinner" style={{ width: 18, height: 18 }} /> : <Share2 />}
            </span>
            <div style={{ flex: 1 }}>
              <h3>Share this recipe</h3>
              <p>{shareNotice ?? "Send someone straight into the guided cook"}</p>
            </div>
            <ChevronRight size={19} style={{ color: "var(--text-faint)" }} />
          </button>
        )}
        <button className="btn btn-primary btn-full" style={{ padding: "16px 20px" }} onClick={() => router.push("/")}>
          <Home /> Back home
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button className="icon-btn" style={{ marginLeft: -8 }} onClick={() => router.push("/")} aria-label="Pause and go home">
          <ArrowLeft />
        </button>
        <span style={{ color: "var(--text-dim)", fontSize: "0.88rem", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {recipe.title}
        </span>
        <span className="badge badge-outline" style={{ flexShrink: 0 }}>
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
        <StepCard
          stepIdx={stepIdx}
          step={step}
          timer={cookTimers.timers.find((t) => t.stepIdx === stepIdx)}
          onStart={cookTimers.start}
          onToggle={cookTimers.toggle}
          onReset={cookTimers.reset}
        />

        {step.watch_for && (
          <div className="step-watch">
            <span className="badge badge-outline step-watch-badge">
              <Eye size={13} /> Watch for
            </span>
            <p className="step-watch-text">{step.watch_for}</p>
          </div>
        )}
      </div>

      {/* nav */}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={() => goTo(stepIdx - 1)} disabled={stepIdx === 0} style={{ flex: 1 }}>
          <ArrowLeft /> Back
        </button>
        {isLast ? (
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={finish}>
            Done — I cooked it <Flame />
          </button>
        ) : (
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => goTo(stepIdx + 1)}>
            Next step <ArrowRight />
          </button>
        )}
      </div>

      {/* chat handle */}
      <button
        className="btn btn-ghost btn-full"
        style={{ marginTop: 10 }}
        onClick={() => setChatOpen(true)}
      >
        <MessageCircle /> Ask Ember anything
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
              {speakReplies ? <Volume2 size={19} /> : <VolumeX size={19} />}
            </button>
          </>
        }
      />
    </main>
  );
}
