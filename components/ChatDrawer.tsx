"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Flame, ImagePlus, X } from "lucide-react";
import type { FileUIPart, UIMessage } from "ai";
import { filesToUIParts } from "@/lib/chatFiles";

function messageText(m: UIMessage): string {
  return m.parts
    .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function messageImages(m: UIMessage): string[] {
  return m.parts
    .filter(
      (p): p is Extract<typeof p, { type: "file" }> =>
        p.type === "file" && p.mediaType.startsWith("image/")
    )
    .map((p) => p.url);
}

export default function ChatDrawer({
  open,
  onClose,
  messages,
  sendMessage,
  busy,
  extraControls,
  notice,
}: {
  open: boolean;
  onClose: () => void;
  messages: UIMessage[];
  sendMessage: (text: string, files?: FileUIPart[]) => void;
  busy: boolean;
  extraControls?: React.ReactNode;
  notice?: string | null;
}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const attachmentPreviews = useMemo(() => attachments.map((f) => URL.createObjectURL(f)), [attachments]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, busy]);

  useEffect(() => {
    return () => attachmentPreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [attachmentPreviews]);

  if (!open) return null;

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || busy) return;
    setInput("");
    const pending = attachments;
    setAttachments([]);
    const files = pending.length ? await filesToUIParts(pending) : undefined;
    sendMessage(text, files);
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
            const images = messageImages(m);
            if (!text && images.length === 0) return null;
            return (
              <div key={m.id} style={{ display: "grid", gap: 6, justifyItems: m.role === "user" ? "end" : "start" }}>
                {images.length > 0 && (
                  <div className="bubble-images">
                    {images.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="Attached" />
                    ))}
                  </div>
                )}
                {text && (
                  <div className={m.role === "user" ? "bubble bubble-user" : "bubble bubble-ai"}>{text}</div>
                )}
              </div>
            );
          })}
          {busy && (
            <div style={{ justifySelf: "start", color: "var(--text-dim)", display: "flex", gap: 8, alignItems: "center", padding: "4px 2px" }}>
              <span className="spinner" style={{ width: 14, height: 14 }} /> thinking…
            </div>
          )}
        </div>

        {notice && (
          <p style={{ color: "var(--text-dim)", fontSize: "0.8rem", padding: "0 18px 6px", textAlign: "center" }}>
            {notice}
          </p>
        )}

        {attachmentPreviews.length > 0 && (
          <div className="chat-attach-preview">
            {attachmentPreviews.map((url, i) => (
              <div key={i} className="chat-attach-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Selected" />
                <button
                  type="button"
                  className="chat-attach-remove"
                  onClick={() => removeAttachment(i)}
                  aria-label="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={submit} style={{ padding: "12px 14px calc(14px + env(safe-area-inset-bottom))" }}>
          <div className="composer" style={{ background: "rgba(14, 12, 10, 0.5)" }}>
            {extraControls}
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files?.length) setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="composer-btn composer-btn-ghost"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
            >
              <ImagePlus size={19} />
            </button>
            <input
              placeholder="e.g. I think I added too much salt…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              className="composer-btn composer-btn-send"
              disabled={busy || (!input.trim() && attachments.length === 0)}
              aria-label="Send"
            >
              <ArrowUp size={19} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
