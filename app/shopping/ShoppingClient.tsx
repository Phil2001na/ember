"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ShoppingItem } from "@/lib/schemas";

/*
 * Offline-first: every change lands in state + localStorage immediately and is
 * queued as an op. The queue flushes to Supabase whenever we're online, so
 * ticking things off in a store with no signal still works — it syncs at home.
 * Ops are keyed by item NAME (unique per user), never by id, because offline-
 * created rows have client-side ids the server never sees.
 */
type Op =
  | {
      kind: "upsert";
      name: string;
      quantity_text: string | null;
      reason: string | null;
      checked: boolean;
    }
  | { kind: "set-checked"; name: string; checked: boolean }
  | { kind: "delete"; name: string }
  | { kind: "pantry-add"; name: string; quantity_text: string | null };

const ITEMS_KEY = "ember-shopping-items";
const QUEUE_KEY = "ember-shopping-queue";

function loadLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function ShoppingClient({
  initialItems,
  pantryNames,
  userId,
}: {
  initialItems: ShoppingItem[];
  pantryNames: string[];
  userId: string;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [pending, setPending] = useState(0); // ops waiting to sync
  const [online, setOnline] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [pantryWarn, setPantryWarn] = useState<string | null>(null);
  const queueRef = useRef<Op[]>([]);
  const flushing = useRef(false);
  const pantrySet = new Set(pantryNames.map((n) => n.toLowerCase()));

  async function runOp(op: Op): Promise<boolean> {
    if (op.kind === "upsert") {
      const { error } = await supabase.from("shopping_items").upsert(
        {
          user_id: userId,
          name: op.name,
          quantity_text: op.quantity_text,
          reason: op.reason,
          checked: op.checked,
        },
        { onConflict: "user_id,name" }
      );
      return !error;
    }
    if (op.kind === "set-checked") {
      const { error } = await supabase
        .from("shopping_items")
        .update({ checked: op.checked })
        .eq("user_id", userId)
        .eq("name", op.name);
      return !error;
    }
    if (op.kind === "delete") {
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .eq("user_id", userId)
        .eq("name", op.name);
      return !error;
    }
    // pantry-add
    const { error } = await supabase.from("pantry_items").upsert(
      { user_id: userId, name: op.name, quantity_text: op.quantity_text, source: "manual" },
      { onConflict: "user_id,name" }
    );
    return !error;
  }

  async function flush() {
    if (flushing.current || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    flushing.current = true;
    try {
      while (queueRef.current.length) {
        const ok = await runOp(queueRef.current[0]).catch(() => false);
        if (!ok) break; // offline or error — keep the op, retry later
        queueRef.current = queueRef.current.slice(1);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queueRef.current));
        setPending(queueRef.current.length);
      }
    } finally {
      flushing.current = false;
    }
  }

  useEffect(() => {
    // if unsynced changes survive from a previous (offline) visit, the local
    // copy of the list is ahead of the server — prefer it, then sync
    const queued = loadLocal<Op[]>(QUEUE_KEY) ?? [];
    if (queued.length) {
      queueRef.current = queued;
      setPending(queued.length);
      const local = loadLocal<ShoppingItem[]>(ITEMS_KEY);
      if (local) setItems(local);
      void flush();
    } else {
      localStorage.setItem(ITEMS_KEY, JSON.stringify(initialItems));
    }
    setOnline(navigator.onLine);
    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mutate(next: ShoppingItem[], ops: Op[]) {
    setItems(next);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(next));
    queueRef.current = [...queueRef.current, ...ops];
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queueRef.current));
    setPending(queueRef.current.length);
    void flush();
  }

  function addItem(raw: string, force = false) {
    const name = raw.trim().toLowerCase();
    if (!name) return;
    if (items.some((i) => i.name === name)) {
      setNewItem("");
      setPantryWarn(null);
      return; // already on the list
    }
    if (!force && pantrySet.has(name)) {
      setPantryWarn(name); // "you've already got this" — confirm first
      return;
    }
    setNewItem("");
    setPantryWarn(null);
    const item: ShoppingItem = {
      id: crypto.randomUUID(),
      name,
      quantity_text: null,
      reason: null,
      checked: false,
      created_at: new Date().toISOString(),
    };
    mutate(
      [item, ...items],
      [{ kind: "upsert", name, quantity_text: null, reason: null, checked: false }]
    );
  }

  function toggle(item: ShoppingItem) {
    mutate(
      items.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)),
      [{ kind: "set-checked", name: item.name, checked: !item.checked }]
    );
  }

  function remove(item: ShoppingItem) {
    mutate(
      items.filter((i) => i.id !== item.id),
      [{ kind: "delete", name: item.name }]
    );
  }

  /** "Already have it" — off the list, into the pantry. */
  function alreadyHave(item: ShoppingItem) {
    mutate(
      items.filter((i) => i.id !== item.id),
      [
        { kind: "delete", name: item.name },
        { kind: "pantry-add", name: item.name, quantity_text: item.quantity_text },
      ]
    );
  }

  /** Done shopping — everything ticked goes into the pantry. */
  function putAway() {
    const bought = items.filter((i) => i.checked);
    if (!bought.length) return;
    mutate(
      items.filter((i) => !i.checked),
      bought.flatMap((i) => [
        { kind: "pantry-add", name: i.name, quantity_text: i.quantity_text } as Op,
        { kind: "delete", name: i.name } as Op,
      ])
    );
  }

  const toBuy = items.filter((i) => !i.checked);
  const inBasket = items.filter((i) => i.checked);

  return (
    <main className="page fade-in">
      <h1 className="page-title">Shopping list</h1>
      <p className="page-sub">
        {items.length
          ? `${toBuy.length} to buy${inBasket.length ? ` · ${inBasket.length} in the basket` : ""}`
          : "Nothing on the list. Add things here, or ask in the Cook chat."}
      </p>

      {pending > 0 && (
        <p
          className="badge badge-warn"
          style={{ display: "inline-flex", marginBottom: 14 }}
        >
          {online
            ? `⏳ syncing ${pending} change${pending === 1 ? "" : "s"}…`
            : `📴 offline — ${pending} change${pending === 1 ? "" : "s"} saved on this phone, will sync later`}
        </p>
      )}

      {/* manual add */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addItem(newItem);
        }}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          className="input"
          placeholder="Add something to buy — e.g. olive oil"
          value={newItem}
          onChange={(e) => {
            setNewItem(e.target.value);
            setPantryWarn(null);
          }}
        />
        <button className="btn btn-ghost" type="submit">
          Add
        </button>
      </form>

      {pantryWarn && (
        <div
          className="card fade-in"
          style={{ marginBottom: 16, borderColor: "var(--amber-400)" }}
        >
          <p style={{ fontSize: "0.9rem", marginBottom: 10 }}>
            🧺 You&apos;ve already got <strong>{pantryWarn}</strong> in your pantry.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => addItem(pantryWarn, true)}>
              Buy more anyway
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setPantryWarn(null);
                setNewItem("");
              }}
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      {/* to buy */}
      <div style={{ display: "grid", gap: 8 }}>
        {toBuy.map((item) => (
          <div
            key={item.id}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}
          >
            <button
              onClick={() => toggle(item)}
              aria-label={`Tick off ${item.name}`}
              style={{
                width: 24,
                height: 24,
                flexShrink: 0,
                borderRadius: "50%",
                border: "2px solid var(--border-strong)",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ textTransform: "capitalize" }}>{item.name}</span>
              {item.quantity_text && (
                <span style={{ color: "var(--text-faint)", fontSize: "0.8rem", marginLeft: 8 }}>
                  {item.quantity_text}
                </span>
              )}
              {item.reason && (
                <div style={{ color: "var(--text-faint)", fontSize: "0.75rem" }}>{item.reason}</div>
              )}
            </div>
            <button
              className="btn btn-ghost"
              style={{ padding: "6px 10px", fontSize: "0.75rem", flexShrink: 0 }}
              onClick={() => alreadyHave(item)}
              title="Already have it — move to pantry"
            >
              🧺 have it
            </button>
            <button
              onClick={() => remove(item)}
              style={{ color: "var(--text-faint)", fontSize: "1.1rem", padding: "4px 6px" }}
              aria-label={`Remove ${item.name}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* in the basket */}
      {inBasket.length > 0 && (
        <>
          <h3 style={{ margin: "20px 0 10px", color: "var(--text-dim)", fontSize: "0.9rem" }}>
            In the basket
          </h3>
          <div style={{ display: "grid", gap: 8 }}>
            {inBasket.map((item) => (
              <div
                key={item.id}
                className="card"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  opacity: 0.6,
                }}
              >
                <button
                  onClick={() => toggle(item)}
                  aria-label={`Untick ${item.name}`}
                  style={{
                    width: 24,
                    height: 24,
                    flexShrink: 0,
                    borderRadius: "50%",
                    background: "var(--green-ok)",
                    color: "var(--char-950)",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </button>
                <span style={{ flex: 1, textTransform: "capitalize", textDecoration: "line-through" }}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 14 }}
            onClick={putAway}
          >
            Done shopping — put {inBasket.length} away in the pantry
          </button>
        </>
      )}
    </main>
  );
}
