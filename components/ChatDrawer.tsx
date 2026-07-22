"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Flame, X } from "lucide-react";
import type { UIMessage } from "ai";

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export default function ChatDrawer({
  open,
  onClose,
  messages,
  sendMessage,
  busy,
  extraControls,
}: {
  open: boolean;
  onClose: () => void;
  messages: UIMessage[];
  sendMessage: (text: string) => void;
  busy: boolean;
  extraControls?: React.ReactNode;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMessage(text);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ height: "70dvh" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 18px 8px" }}>
          <h3 style={{ fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
            Ask Ember <Flame size={17} style={{ color: "var(--accent-icon)" }} />
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "6px 18px", display: "grid", gap: 10, alignContent: "start" }}>
          {messages.length === 0 && (
            <p style={{ color: "var(--text-faint)", fontSize: "0.9rem", textAlign: "center", padding: "30px 10px" }}>
              Stuck? Over-salted? Missing something? Ask mid-cook — Ember knows exactly where you are in the recipe.
            </p>
          )}
          {messages.map((m) => {
            const text = messageText(m);
            if (!text) return null;
            return (
              <div
                key={m.id}
                className={m.role === "user" ? "bubble bubble-user" : "bubble bubble-ai"}
                style={{ justifySelf: m.role === "user" ? "end" : "start" }}
              >
                {text}
              </div>
            );
          })}
          {busy && (
            <div style={{ justifySelf: "start", color: "var(--text-dim)", display: "flex", gap: 8, alignItems: "center", padding: "4px 2px" }}>
              <span className="spinner" style={{ width: 14, height: 14 }} /> thinking…
            </div>
          )}
        </div>

        <form onSubmit={submit} style={{ padding: "12px 14px calc(14px + env(safe-area-inset-bottom))" }}>
          <div className="composer" style={{ background: "rgba(14, 12, 10, 0.5)" }}>
            {extraControls}
            <input
              placeholder="e.g. I think I added too much salt…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="composer-btn composer-btn-send" disabled={busy || !input.trim()} aria-label="Send">
              <ArrowUp size={19} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
