"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { EQUIPMENT_OPTIONS } from "@/lib/schemas";

const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner", blurb: "Nobody ever taught me — walk me through everything" },
  { value: "comfortable", label: "Comfortable", blurb: "I can cook a few things without burning the house down" },
  { value: "confident", label: "Confident", blurb: "I know my way around, just give me the recipe" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<Set<string>>(
    new Set(["stove", "pots & pans"])
  );
  const [skill, setSkill] = useState<string>("beginner");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(item: string) {
    setEquipment((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: profileErr } = await supabase.from("profiles").upsert({
      user_id: user.id,
      display_name: name.trim() || null,
      skill_level: skill,
    });
    if (profileErr) {
      setBusy(false);
      return setError(profileErr.message);
    }

    await supabase.from("equipment").delete().eq("user_id", user.id);
    const { error: equipErr } = await supabase
      .from("equipment")
      .insert([...equipment].map((name) => ({ user_id: user.id, name })));
    setBusy(false);
    if (equipErr) return setError(equipErr.message);

    router.push("/pantry?first=1");
  }

  return (
    <main className="page fade-in" style={{ paddingTop: 40 }}>
      <h1 className="page-title">Your kitchen</h1>
      <p className="page-sub">
        Ember tailors every recipe to what you actually have.
      </p>

      <label style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
        What should we call you?
      </label>
      <input
        className="input"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ margin: "6px 0 22px" }}
      />

      <h3 style={{ marginBottom: 10 }}>Equipment</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
        {EQUIPMENT_OPTIONS.map((item) => (
          <button
            key={item}
            className={`chip ${equipment.has(item) ? "selected" : ""}`}
            onClick={() => toggle(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <h3 style={{ marginBottom: 10 }}>How's your cooking?</h3>
      <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
        {SKILL_LEVELS.map((lvl) => (
          <button
            key={lvl.value}
            className="card"
            onClick={() => setSkill(lvl.value)}
            style={{
              textAlign: "left",
              borderColor: skill === lvl.value ? "var(--ember-500)" : "var(--border)",
              background: skill === lvl.value ? "var(--accent-soft)" : "var(--surface)",
            }}
          >
            <strong>{lvl.label}</strong>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{lvl.blurb}</p>
          </button>
        ))}
      </div>

      {error && (
        <p style={{ color: "var(--red-warn)", fontSize: "0.9rem", marginBottom: 12 }}>{error}</p>
      )}

      <button className="btn btn-primary btn-full" onClick={save} disabled={busy}>
        {busy ? <span className="spinner" /> : "Next: fill my pantry"}
      </button>
    </main>
  );
}
