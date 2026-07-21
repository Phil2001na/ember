"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Mic, Sparkles } from "lucide-react";
import PushToTalk from "@/components/PushToTalk";
import { createClient } from "@/lib/supabase/client";
import { EQUIPMENT_OPTIONS, type PantryImport } from "@/lib/schemas";

const SKILL_LEVELS = [
  { value: "beginner", label: "Beginner", blurb: "Nobody ever taught me — walk me through everything" },
  { value: "comfortable", label: "Comfortable", blurb: "I can cook a few things without burning the house down" },
  { value: "confident", label: "Confident", blurb: "I know my way around, just give me the recipe" },
] as const;

type PendingPantryItem = PantryImport["items"][number] & { keep: boolean };

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [equipment, setEquipment] = useState<Set<string>>(new Set(["stove", "pots & pans"]));
  const [skill, setSkill] = useState<string>("beginner");
  const [stage, setStage] = useState<"kitchen" | "pantry">("kitchen");
  const [pantryRant, setPantryRant] = useState("");
  const [pantryItems, setPantryItems] = useState<PendingPantryItem[] | null>(null);
  const [extracting, setExtracting] = useState(false);
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

  async function saveKitchen() {
    setBusy(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setBusy(false);
      return setError("Ember couldn't start your kitchen. Please try again.");
    }

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
      .insert([...equipment].map((equipmentName) => ({ user_id: user.id, name: equipmentName })));
    setBusy(false);
    if (equipErr) return setError(equipErr.message);
    setStage("pantry");
  }

  async function extractPantry() {
    if (!pantryRant.trim()) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch("/api/pantry-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pantryRant }),
      });
      if (!res.ok) throw new Error("I couldn't make out that pantry list. Try saying it another way?");
      const data = (await res.json()) as PantryImport;
      setPantryItems(data.items.map((item) => ({ ...item, keep: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setExtracting(false);
    }
  }

  async function finishPantry() {
    const keep = pantryItems?.filter((item) => item.keep) ?? [];
    if (keep.length) {
      setBusy(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setBusy(false);
        return setError("Ember lost track of your kitchen. Please try again.");
      }
      const { error: pantryErr } = await supabase.from("pantry_items").upsert(
        keep.map((item) => ({
          user_id: user.id,
          name: item.name.trim().toLowerCase(),
          quantity_text: item.quantity_estimate,
          source: "manual" as const,
        })),
        { onConflict: "user_id,name" }
      );
      setBusy(false);
      if (pantryErr) return setError(pantryErr.message);
    }
    router.push("/");
  }

  if (stage === "pantry") {
    return (
      <main className="page fade-in" style={{ paddingTop: 40 }}>
        <p className="badge badge-accent" style={{ display: "inline-flex", marginBottom: 14 }}>
          One last thing
        </p>
        <h1 className="page-title">What food is around?</h1>
        <p className="page-sub">
          Don&apos;t catalogue it. Just ramble about your fridge, cupboards, freezer, spices—whatever comes to mind.
        </p>

        {!pantryItems ? (
          <>
            <div className="card" style={{ padding: 12, marginBottom: 14 }}>
              <textarea
                className="input"
                rows={6}
                placeholder="I've got some tuna, bread, butter, mozzarella, half an onion, chilli flakes..."
                value={pantryRant}
                onChange={(e) => setPantryRant(e.target.value)}
                style={{ resize: "vertical", marginBottom: 10 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <PushToTalk
                  disabled={extracting}
                  onTranscript={(text) =>
                    setPantryRant((current) => `${current}${current ? " " : ""}${text}`)
                  }
                />
                <span style={{ color: "var(--text-dim)", fontSize: "0.84rem" }}>
                  <Mic size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  Hold the mic and talk naturally
                </span>
              </div>
            </div>

            {error && <p style={{ color: "var(--red-warn)", marginBottom: 12 }}>{error}</p>}

            <button
              className="btn btn-primary btn-full"
              onClick={extractPantry}
              disabled={extracting || !pantryRant.trim()}
            >
              {extracting ? (
                <><span className="spinner" /> Listening to your kitchen…</>
              ) : (
                <><Sparkles /> Find what I mentioned</>
              )}
            </button>
            <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={() => router.push("/")}>
              Skip for now
            </button>
          </>
        ) : (
          <>
            <div className="card fade-in" style={{ marginBottom: 18, borderColor: "var(--ember-500)" }}>
              <h3 style={{ marginBottom: 5 }}>I caught {pantryItems.length} things</h3>
              <p style={{ color: "var(--text-dim)", fontSize: "0.84rem", marginBottom: 14 }}>
                This doesn&apos;t need to be perfect. Tap anything I misheard.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {pantryItems.map((item, index) => (
                  <button
                    key={`${item.name}-${index}`}
                    className={`chip ${item.keep ? "selected" : ""}`}
                    style={!item.keep ? { opacity: 0.4, textDecoration: "line-through" } : undefined}
                    onClick={() =>
                      setPantryItems((current) =>
                        current!.map((entry, i) =>
                          i === index ? { ...entry, keep: !entry.keep } : entry
                        )
                      )
                    }
                  >
                    {item.name}{item.quantity_estimate ? ` · ${item.quantity_estimate}` : ""}
                  </button>
                ))}
              </div>
            </div>
            {error && <p style={{ color: "var(--red-warn)", marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary btn-full" onClick={finishPantry} disabled={busy}>
              {busy ? (
                <span className="spinner" />
              ) : (
                <>Add {pantryItems.filter((item) => item.keep).length} and meet Ember <ArrowRight /></>
              )}
            </button>
            <button className="btn btn-ghost btn-full" style={{ marginTop: 10 }} onClick={() => setPantryItems(null)}>
              Say it again
            </button>
          </>
        )}
      </main>
    );
  }

  return (
    <main className="page fade-in" style={{ paddingTop: 40 }}>
      <h1 className="page-title">Your kitchen</h1>
      <p className="page-sub">Ember tailors every recipe to what you actually have.</p>

      <label style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>What should we call you?</label>
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
          <button key={item} className={`chip ${equipment.has(item) ? "selected" : ""}`} onClick={() => toggle(item)}>
            {item}
          </button>
        ))}
      </div>

      <h3 style={{ marginBottom: 10 }}>How&apos;s your cooking?</h3>
      <div style={{ display: "grid", gap: 10, marginBottom: 28 }}>
        {SKILL_LEVELS.map((level) => (
          <button
            key={level.value}
            className="card"
            onClick={() => setSkill(level.value)}
            style={{
              textAlign: "left",
              borderColor: skill === level.value ? "var(--ember-500)" : "var(--border)",
              background: skill === level.value ? "var(--accent-soft)" : "var(--surface)",
            }}
          >
            <strong>{level.label}</strong>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{level.blurb}</p>
          </button>
        ))}
      </div>

      {error && <p style={{ color: "var(--red-warn)", fontSize: "0.9rem", marginBottom: 12 }}>{error}</p>}

      <button className="btn btn-primary btn-full" onClick={saveKitchen} disabled={busy}>
        {busy ? <span className="spinner" /> : <>Next: tell Ember what&apos;s around <ArrowRight /></>}
      </button>
    </main>
  );
}
