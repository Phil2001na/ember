"use client";

import { FormEvent, useState } from "react";
import { Brain, MessageSquareText, Plus, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Preference = { id: string; text: string };

export default function KitchenPreferences({ initialPreferences, userId }: { initialPreferences: Preference[]; userId: string }) {
  const supabase = createClient();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (value.length < 2 || busy) return;
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await supabase
      .from("kitchen_preferences")
      .insert({ user_id: userId, text: value })
      .select("id, text")
      .single();
    setBusy(false);
    if (saveError) return setError(saveError.code === "23505" ? "Ember already remembers that." : saveError.message);
    setPreferences((current) => [data as Preference, ...current]);
    setText("");
  }

  async function remove(preference: Preference) {
    setError(null);
    setPreferences((current) => current.filter((item) => item.id !== preference.id));
    const { error: deleteError } = await supabase
      .from("kitchen_preferences")
      .delete()
      .eq("id", preference.id)
      .eq("user_id", userId);
    if (deleteError) {
      setPreferences((current) => [preference, ...current]);
      setError(deleteError.message);
    }
  }

  return (
    <>
      <div className="section-head">
        <Brain /> What Ember remembers
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 }}>
          Things you choose to keep in mind across meals: dislikes, your household, time limits, or how you like to cook.
        </p>
        {preferences.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            {preferences.map((preference) => (
              <div key={preference.id} className="chip selected" style={{ justifyContent: "space-between", gap: 10, textAlign: "left" }}>
                <span>{preference.text}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => remove(preference)}
                  aria-label={`Forget ${preference.text}`}
                  style={{ width: 26, height: 26, margin: -4, flexShrink: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={add} style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="e.g. Weeknights need to be quick"
            value={text}
            maxLength={280}
            onChange={(event) => setText(event.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={busy || text.trim().length < 2} aria-label="Remember preference">
            <Plus size={17} />
          </button>
        </form>
        {error && <p style={{ color: "var(--red-warn)", fontSize: "0.82rem", marginTop: 10 }}>{error}</p>}
      </div>
    </>
  );
}

export function ChatHistoryControls({ userId }: { userId: string }) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function clearHistory() {
    if (busy) return;
    if (!window.confirm("Clear all kitchen-chat history? Ember will keep your pantry, saved recipes, and preferences.")) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.from("kitchen_messages").delete().eq("user_id", userId);
    setBusy(false);
    setNotice(error ? "Couldn't clear chat history yet." : "Chat history cleared. Your kitchen details are still here.");
  }

  return (
    <>
      <div className="section-head">
        <MessageSquareText /> Chat history
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 }}>
          Clear the conversations Ember keeps for continuity. This doesn&apos;t affect your pantry, recipes, or preferences.
        </p>
        <button className="btn btn-ghost" onClick={clearHistory} disabled={busy}>
          <Trash2 size={16} /> {busy ? "Clearingâ€¦" : "Clear chat history"}
        </button>
        {notice && <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", marginTop: 10 }}>{notice}</p>}
      </div>
    </>
  );
}
