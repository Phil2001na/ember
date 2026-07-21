"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, CookingPot, Flame, ShoppingBasket, ShoppingCart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, Suggestion } from "@/lib/schemas";
import RecipePreview from "@/components/RecipePreview";
import SuggestionCarousel from "@/components/SuggestionCarousel";
import PantrySheet from "@/components/PantrySheet";
import PushToTalk from "@/components/PushToTalk";
import type { HomeNudge } from "@/lib/homeNudge";

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function messagePantryUpdates(m: UIMessage): { added: string[]; removed: string[] }[] {
  const updates: { added: string[]; removed: string[] }[] = [];
  for (const part of m.parts) {
    if (part.type === "tool-update_pantry" && part.state === "output-available" && part.output) {
      const { added, removed } = part.output as { added: string[]; removed: string[] };
      if (added?.length || removed?.length) updates.push({ added: added ?? [], removed: removed ?? [] });
    }
  }
  return updates;
}

function messageShoppingUpdates(
  m: UIMessage
): { added: string[]; removed: string[]; already_have: string[] }[] {
  const updates: { added: string[]; removed: string[]; already_have: string[] }[] = [];
  for (const part of m.parts) {
    if (part.type === "tool-update_shopping_list" && part.state === "output-available" && part.output) {
      const { added, removed, already_have } = part.output as {
        added: string[];
        removed: string[];
        already_have: string[];
      };
      if (added?.length || removed?.length || already_have?.length)
        updates.push({ added: added ?? [], removed: removed ?? [], already_have: already_have ?? [] });
    }
  }
  return updates;
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
  nudge,
}: {
  greeting: string;
  pantryEmpty: boolean;
  activeSession: { id: string; title: string; step: number } | null;
  nudge: HomeNudge;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [input, setInput] = useState("");
  const [picked, setPicked] = useState<Suggestion | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [starting, setStarting] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [listNotice, setListNotice] = useState<string | null>(null);
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

  async function addMissingToList(s: Suggestion) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("shopping_items").upsert(
      s.missing.map((m) => ({
        user_id: user!.id,
        name: m.item.trim().toLowerCase(),
        reason: `for ${s.title.toLowerCase()}`,
      })),
      { onConflict: "user_id,name" }
    );
    setListNotice(
      error
        ? "Couldn't update the shopping list — try again?"
        : `Added ${s.missing.length} item${s.missing.length === 1 ? "" : "s"} to your shopping list`
    );
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
        zIndex: 60,
      }}
    >
      <div style={{ padding: "20px 18px 10px" }}>
        <h1 className="page-title title-glow" style={{ fontSize: "1.35rem", marginBottom: activeSession ? 8 : 0, display: "flex", alignItems: "center", gap: 8 }}>
          {greeting} <Flame size={20} style={{ color: "var(--ember-400)", flexShrink: 0 }} />
        </h1>
        {activeSession && (
          <Link href={`/cook/${activeSession.id}`} className="badge badge-accent" style={{ display: "inline-flex" }}>
            <CookingPot /> Resume {activeSession.title} — step {activeSession.step + 1}
          </Link>
        )}
      </div>

      {pantryEmpty && (
        <div style={{ padding: "0 18px 10px" }}>
          <div className="card" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <p style={{ fontSize: "0.82rem", color: "var(--text-dim)" }}>
              Your pantry&apos;s empty — tell me what you&apos;ve got, or fill it in properly.
            </p>
            <Link href="/pantry" className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: "0.8rem", flexShrink: 0 }}>
              Add items
            </Link>
          </div>
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "6px 18px", display: "grid", gap: 12, alignContent: "start" }}>
        {messages.length === 0 && (
          <button
            className="card fade-in"
            onClick={() => sendMessage({ text: nudge.prompt })}
            disabled={busy}
            style={{
              color: "var(--text-dim)",
              fontSize: "0.92rem",
              textAlign: "left",
              marginTop: 26,
              padding: "16px 18px",
              borderColor: "var(--border-strong)",
            }}
          >
            {nudge.text}
            <span style={{ display: "block", color: "var(--ember-400)", marginTop: 8, fontSize: "0.8rem" }}>
              Try it →
            </span>
          </button>
        )}
        {messages.map((m) => {
          const text = messageText(m);
          const suggestionGroups = messageSuggestions(m);
          const pantryUpdates = messagePantryUpdates(m);
          const shoppingUpdates = messageShoppingUpdates(m);
          return (
            <div key={m.id} style={{ display: "grid", gap: 10, minWidth: 0, maxWidth: "100%", justifyItems: m.role === "user" ? "end" : "start" }}>
              {pantryUpdates.map((u, i) => (
                <span key={`pu-${i}`} className="badge badge-accent" style={{ justifySelf: "start" }}>
                  <ShoppingBasket />{" "}
                  {[
                    u.added.length ? `+ ${u.added.join(", ")}` : null,
                    u.removed.length ? `− ${u.removed.join(", ")}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </span>
              ))}
              {shoppingUpdates.map((u, i) => (
                <span key={`su-${i}`} className="badge badge-accent" style={{ justifySelf: "start" }}>
                  <ShoppingCart />{" "}
                  {[
                    u.added.length ? `+ ${u.added.join(", ")}` : null,
                    u.removed.length ? `− ${u.removed.join(", ")}` : null,
                    u.already_have.length ? `already in pantry: ${u.already_have.join(", ")}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </span>
              ))}
              {text && (
                <div
                  className={m.role === "user" ? "bubble bubble-user" : "bubble bubble-ai"}
                  style={{ justifySelf: m.role === "user" ? "end" : "start" }}
                >
                  {text}
                </div>
              )}
              {suggestionGroups.map((group, i) => (
                <div key={i} style={{ width: "100%" }}>
                  <SuggestionCarousel suggestions={group} onPick={pick} onAddMissing={addMissingToList} />
                </div>
              ))}
            </div>
          );
        })}
        {genError && <p style={{ color: "var(--red-warn)", fontSize: "0.85rem" }}>{genError}</p>}
        {listNotice && (
          <span className="badge badge-accent fade-in" style={{ justifySelf: "start" }}>
            <ShoppingCart /> {listNotice}
          </span>
        )}
        {busy && (
          <div style={{ justifySelf: "start", color: "var(--text-dim)", display: "flex", gap: 8, alignItems: "center", padding: "4px 2px" }}>
            <span className="spinner" style={{ width: 14, height: 14 }} /> thinking…
          </div>
        )}
      </div>

      <form onSubmit={submit} style={{ padding: "10px 14px" }}>
        <div className="composer">
          <button
            type="button"
            className="composer-btn composer-btn-ghost"
            onClick={() => setPantryOpen(true)}
            aria-label="Open pantry"
          >
            <ShoppingBasket size={19} />
          </button>
          <input
            placeholder="e.g. I've got chicken and rice, no idea…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <PushToTalk disabled={busy} onTranscript={(text) => sendMessage({ text })} />
          <button className="composer-btn composer-btn-send" disabled={busy || !input.trim()} aria-label="Send">
            <ArrowUp size={19} />
          </button>
        </div>
      </form>

      <PantrySheet open={pantryOpen} onClose={() => setPantryOpen(false)} />
    </div>
  );
}
