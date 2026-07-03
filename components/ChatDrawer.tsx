"use client";

import { useEffect, useRef, useState } from "react";
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        className="fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)",
          borderRadius: "20px 20px 0 0",
          border: "1px solid var(--border)",
          borderBottom: "none",
          maxWidth: 560,
          width: "100%",
          margin: "0 auto",
          height: "70dvh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px 8px" }}>
          <h3 style={{ fontSize: "1.05rem" }}>Ask Ember 🔥</h3>
          <button onClick={onClose} style={{ color: "var(--text-faint)", padding: 6 }}>
            ✕
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
            );
          })}
          {busy && (
            <div style={{ justifySelf: "start", color: "var(--text-dim)", display: "flex", gap: 8, alignItems: "center", padding: "4px 2px" }}>
              <span className="spinner" style={{ width: 14, height: 14 }} /> thinking…
            </div>
          )}
        </div>

        <form onSubmit={submit} style={{ display: "flex", gap: 8, padding: "12px 18px calc(14px + env(safe-area-inset-bottom))" }}>
          {extraControls}
          <input
            className="input"
            placeholder="e.g. I think I added too much salt…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy || !input.trim()}>
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
