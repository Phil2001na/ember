"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, Suggestion } from "@/lib/schemas";
import RecipePreview from "@/components/RecipePreview";
import SuggestionCarousel from "@/components/SuggestionCarousel";

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function messageSuggestions(m: UIMessage): Suggestion[][] {
  const groups: Suggestion[][] = [];
  for (const part of m.parts) {
    if (
      part.type === "tool-suggest_dishes" &&
      "input" in part &&
      part.input &&
      (part.state === "output-available" || part.state === "input-available")
    ) {
      const suggestions = (part.input as { suggestions: Suggestion[] }).suggestions;
      if (suggestions?.length) groups.push(suggestions);
    }
  }
  return groups;
}

export default function KitchenChat({
  greeting,
  pantryEmpty,
  activeSession,
}: {
  greeting: string;
  pantryEmpty: boolean;
  activeSession: { id: string; title: string; step: number } | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [starting, setStarting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/kitchen-chat" }),
  });
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage({ text });
  }

  async function pick(s: Suggestion) {
    setPicked(s);
    setRecipe(null);
    setGenError(null);
    try {
      const notes = s.missing.length
        ? `Missing: ${s.missing
            .map((m) => `${m.item}${m.substitution ? ` (substitute: ${m.substitution})` : ""}`)
            .join(", ")}`
        : undefined;
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: s.title, notes }),
      });
      if (!res.ok) throw new Error("Couldn't write that recipe — try another dish.");
      setRecipe(await res.json());
    } catch (err) {
      setPicked(null);
      setGenError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function startCooking(recipe: Recipe) {
    setStarting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("cook_sessions")
      .insert({ user_id: user!.id, recipe, status: "active" })
      .select("id")
      .single();
    setStarting(false);
    if (error || !data) {
      setGenError(error?.message ?? "Couldn't start session");
      return;
    }
    router.push(`/cook/${data.id}`);
  }

  if (picked) {
    return (
      <main className="page fade-in">
        {!recipe ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-dim)" }}>
            <span className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px", display: "block", color: "var(--ember-400)" }} />
            Writing your {picked.title} recipe…
          </div>
        ) : (
          <RecipePreview
            recipe={recipe}
            starting={starting}
            onStart={() => startCooking(recipe)}
            onBack={() => {
              setPicked(null);
              setRecipe(null);
            }}
          />
        )}
      </main>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: "calc(84px + env(safe-area-inset-bottom))",
        maxWidth: 560,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "20px 18px 10px" }}>
        <h1 className="page-title" style={{ fontSize: "1.35rem", marginBottom: activeSession ? 8 : 0 }}>
          {greeting} 🔥
        </h1>
        {activeSession && (
          <Link href={`/cook/${activeSession.id}`} className="badge badge-accent" style={{ display: "inline-flex" }}>
            🍳 Resume {activeSession.title} — step {activeSession.step + 1}
          </Link>
        )}
      </div>

      {pantryEmpty && (
        <div style={{ padding: "0 18px 10px" }}>
          <div className="card" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
              Your pantry's empty — tell me what you've got, or fill it in properly.
            </p>
            <Link href="/pantry" className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: "0.8rem", flexShrink: 0 }}>
              Add items
            </Link>
          </div>
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "6px 18px", display: "grid", gap: 12, alignContent: "start" }}>
        {messages.length === 0 && (
          <p style={{ color: "var(--text-faint)", fontSize: "0.9rem", textAlign: "center", padding: "40px 10px" }}>
            Tell me what you want to cook, or what you've got and I'll figure out the rest.
          </p>
        )}
        {messages.map((m) => {
          const text = messageText(m);
          const suggestionGroups = messageSuggestions(m);
          return (
            <div key={m.id} style={{ display: "grid", gap: 10, justifyItems: m.role === "user" ? "end" : "start" }}>
              {text && (
                <div
                  style={{
                    justifySelf: m.role === "user" ? "end" : "start",
                    maxWidth: "85%",
                    background: m.role === "user" ? "var(--accent-soft)" : "var(--surface-2)",
                    border: `1px solid ${m.role === "user" ? "var(--ember-500)" : "var(--border)"}`,
                    borderRadius: 14,
                    padding: "10px 13px",
                    fontSize: "0.95rem",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {text}
                </div>
              )}
              {suggestionGroups.map((group, i) => (
                <div key={i} style={{ width: "100%" }}>
                  <SuggestionCarousel suggestions={group} onPick={pick} />
                </div>
              ))}
            </div>
          );
        })}
        {genError && <p style={{ color: "var(--red-warn)", fontSize: "0.85rem" }}>{genError}</p>}
        {busy && (
          <div style={{ justifySelf: "start", color: "var(--text-dim)", display: "flex", gap: 8, alignItems: "center", padding: "4px 2px" }}>
            <span className="spinner" style={{ width: 14, height: 14 }} /> thinking…
          </div>
        )}
      </div>

      <form onSubmit={submit} style={{ display: "flex", gap: 8, padding: "10px 18px" }}>
        <input
          className="input"
          placeholder="e.g. I've got chicken and rice, no idea what to do…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button className="btn btn-primary" disabled={busy || !input.trim()}>
          ↑
        </button>
      </form>
    </div>
  );
}
