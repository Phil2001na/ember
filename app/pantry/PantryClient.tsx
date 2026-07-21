"use client";

import { useRef, useState } from "react";
import { Camera, ShoppingCart, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PantryItem, VisionResult } from "@/lib/schemas";

type PendingItem = VisionResult["items"][number] & { keep: boolean };

export default function PantryClient({
  initialItems,
  userId,
}: {
  initialItems: PantryItem[];
  userId: string;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<PantryItem[]>(initialItems);
  const [newItem, setNewItem] = useState("");
  const [scanning, setScanning] = useState(false);
  const [pending, setPending] = useState<PendingItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    const name = newItem.trim().toLowerCase();
    if (!name) return;
    setNewItem("");
    const { data, error } = await supabase
      .from("pantry_items")
      .upsert(
        { user_id: userId, name, source: "manual" },
        { onConflict: "user_id,name" }
      )
      .select()
      .single();
    if (error) return setError(error.message);
    setItems((prev) => [data as PantryItem, ...prev.filter((i) => i.name !== name)]);
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("pantry_items").delete().eq("id", id);
  }

  /** Ran out — off the pantry, straight onto the shopping list. */
  async function outOf(item: PantryItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await supabase.from("pantry_items").delete().eq("id", item.id);
    await supabase.from("shopping_items").upsert(
      {
        user_id: userId,
        name: item.name,
        quantity_text: item.quantity_text,
        reason: null,
        checked: false,
      },
      { onConflict: "user_id,name" }
    );
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/vision", { method: "POST", body: form });
      if (!res.ok) throw new Error("Couldn't read that photo — try again with more light?");
      const result: VisionResult = await res.json();
      if (!result.items.length) {
        setError("Couldn't spot any ingredients in that photo. Try a closer shot?");
      } else {
        setPending(result.items.map((i) => ({ ...i, keep: true })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setScanning(false);
    }
  }

  async function confirmPending() {
    if (!pending) return;
    const keep = pending.filter((p) => p.keep);
    setPending(null);
    if (!keep.length) return;
    const { data, error } = await supabase
      .from("pantry_items")
      .upsert(
        keep.map((p) => ({
          user_id: userId,
          name: p.name.toLowerCase(),
          quantity_text: p.quantity_estimate,
          source: "photo" as const,
        })),
        { onConflict: "user_id,name" }
      )
      .select();
    if (error) return setError(error.message);
    const names = new Set((data as PantryItem[]).map((d) => d.name));
    setItems((prev) => [
      ...(data as PantryItem[]),
      ...prev.filter((i) => !names.has(i.name)),
    ]);
  }

  return (
    <main className="page fade-in">
      <h1 className="page-title">Pantry</h1>
      <p className="page-sub">
        {items.length
          ? `${items.length} ingredient${items.length === 1 ? "" : "s"} on hand`
          : "Snap a photo of your fridge, shelf, or groceries to get started."}
      </p>

      {/* photo scan */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onPhoto}
      />
      <button
        className="btn btn-primary btn-full"
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        style={{ marginBottom: 12 }}
      >
        {scanning ? (
          <>
            <span className="spinner" /> Reading your kitchen…
          </>
        ) : (
          <>
            <Camera /> Scan with camera
          </>
        )}
      </button>

      {/* manual add */}
      <form onSubmit={addManual} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          className="input"
          placeholder="Add by hand — e.g. rice"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
        />
        <button className="btn btn-ghost" type="submit">
          Add
        </button>
      </form>

      {error && (
        <p style={{ color: "var(--red-warn)", fontSize: "0.9rem", marginBottom: 12 }}>{error}</p>
      )}

      {/* confirm sheet after vision */}
      {pending && (
        <div className="card fade-in" style={{ marginBottom: 20, borderColor: "var(--ember-500)" }}>
          <h3 style={{ marginBottom: 4 }}>Found {pending.length} ingredients</h3>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 12 }}>
            Tap to remove anything that's wrong.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            {pending.map((p, i) => (
              <button
                key={i}
                className={`chip ${p.keep ? "selected" : ""}`}
                style={!p.keep ? { opacity: 0.4, textDecoration: "line-through" } : undefined}
                onClick={() =>
                  setPending((prev) =>
                    prev!.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x))
                  )
                }
              >
                {p.name}
                {p.quantity_estimate && (
                  <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
                    · {p.quantity_estimate}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmPending}>
              Add {pending.filter((p) => p.keep).length} to pantry
            </button>
            <button className="btn btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* items */}
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.id}
            className="card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
            }}
          >
            <div>
              <span style={{ textTransform: "capitalize" }}>{item.name}</span>
              {item.quantity_text && (
                <span style={{ color: "var(--text-faint)", fontSize: "0.8rem", marginLeft: 8 }}>
                  {item.quantity_text}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: "6px 10px", fontSize: "0.75rem", flexShrink: 0 }}
                onClick={() => outOf(item)}
                title="Ran out — move to shopping list"
              >
                <ShoppingCart size={14} /> buy again
              </button>
              <button
                onClick={() => remove(item.id)}
                style={{ color: "var(--text-faint)", padding: "4px 8px", display: "inline-flex" }}
                aria-label={`Remove ${item.name}`}
              >
                <X size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
