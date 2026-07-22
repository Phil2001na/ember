"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBasket, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { PantryItem } from "@/lib/schemas";

/** Attachment-style pantry peek inside the chat: tap what you don't have, quick-add what you do. */
export default function PantrySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<PantryItem[] | null>(null);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    if (!open) return;
    setItems(null);
    supabase
      .from("pantry_items")
      .select("*")
      .order("updated_at", { ascending: false })
      .then(({ data }) => setItems((data as PantryItem[]) ?? []));
  }, [open, supabase]);

  if (!open) return null;

  async function remove(item: PantryItem) {
    setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? null);
    await supabase.from("pantry_items").delete().eq("id", item.id);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = newItem.trim().toLowerCase();
    if (!name) return;
    setNewItem("");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("pantry_items")
      .upsert({ user_id: user!.id, name, source: "manual" }, { onConflict: "user_id,name" })
      .select()
      .single();
    if (data) {
      setItems((prev) => [data as PantryItem, ...(prev?.filter((i) => i.name !== name) ?? [])]);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "70dvh" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 18px 4px" }}>
          <h3 style={{ fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
            Your pantry <ShoppingBasket size={17} style={{ color: "var(--accent-icon)" }} />
          </h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p style={{ color: "var(--text-dim)", fontSize: "0.82rem", padding: "0 18px 10px" }}>
          Tap anything you don&apos;t actually have.{" "}
          <Link href="/pantry" style={{ color: "var(--accent-icon-soft)", textDecoration: "underline" }}>
            Full pantry &amp; camera scan
          </Link>
        </p>

        <div style={{ flex: 1, overflowY: "auto", padding: "2px 18px 10px" }}>
          {items === null ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
              <span className="spinner" style={{ width: 20, height: 20 }} />
            </div>
          ) : items.length === 0 ? (
            <p style={{ color: "var(--text-faint)", fontSize: "0.9rem", textAlign: "center", padding: "20px 0" }}>
              Nothing in here yet — add below, or just tell Ember what you&apos;ve got.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {items.map((item) => (
                <button key={item.id} className="chip" onClick={() => remove(item)}>
                  {item.name}
                  {item.quantity_text && (
                    <span style={{ fontSize: "0.75rem", opacity: 0.7 }}> · {item.quantity_text}</span>
                  )}
                  <X size={13} style={{ opacity: 0.5, marginLeft: 2 }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={add} style={{ display: "flex", gap: 8, padding: "10px 18px calc(14px + env(safe-area-inset-bottom))" }}>
          <input
            className="input"
            placeholder="Quick add — e.g. eggs"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
          />
          <button className="btn btn-ghost" type="submit" disabled={!newItem.trim()}>
            Add
          </button>
        </form>
      </div>
    </div>
  );
}
