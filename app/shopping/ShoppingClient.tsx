"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ChefHat,
  CookingPot,
  RefreshCw,
  ShoppingBasket,
  Sparkles,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Skeleton from "@/components/Skeleton";
import RecipePreview from "@/components/RecipePreview";
import RecipePreviewSkeleton from "@/components/RecipePreviewSkeleton";
import type {
  DishCheck,
  DishRecognize,
  PlannedMeal,
  Recipe,
  ShoppingItem,
  ShoppingSuggestions,
} from "@/lib/schemas";

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
  initialPlanned,
  userId,
}: {
  initialItems: ShoppingItem[];
  pantryNames: string[];
  initialPlanned: PlannedMeal[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [pending, setPending] = useState(0); // ops waiting to sync
  const [online, setOnline] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [pantryWarn, setPantryWarn] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ShoppingSuggestions["items"] | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(false);
  const queueRef = useRef<Op[]>([]);
  const flushing = useRef(false);
  const pantrySet = new Set(pantryNames.map((n) => n.toLowerCase()));

  // "I want to make X" — Ember works out the ingredients, adds what's
  // missing to the list, and remembers the dish so it can be started later.
  const [planned, setPlanned] = useState<PlannedMeal[]>(initialPlanned);
  const [planInput, setPlanInput] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planCheck, setPlanCheck] = useState<DishCheck | null>(null);
  const [planError, setPlanError] = useState(false);
  const [cooking, setCooking] = useState<PlannedMeal | null>(null);
  const [cookRecipe, setCookRecipe] = useState<Recipe | null>(null);
  const [cookError, setCookError] = useState<string | null>(null);
  const [startingCook, setStartingCook] = useState(false);
  const dishPhotoRef = useRef<HTMLInputElement>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognizeNote, setRecognizeNote] = useState<DishRecognize | null>(null);
  const [recognizeError, setRecognizeError] = useState(false);

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

  /** Ask Ember to draft the list from the pantry. */
  async function suggest() {
    setSuggesting(true);
    setSuggestError(false);
    try {
      const res = await fetch("/api/shopping-suggest", { method: "POST" });
      if (!res.ok) throw new Error("suggest failed");
      const data = (await res.json()) as ShoppingSuggestions;
      const onList = new Set(items.map((i) => i.name));
      setSuggestions(data.items.filter((s) => !onList.has(s.name.trim().toLowerCase())));
    } catch {
      setSuggestError(true);
    } finally {
      setSuggesting(false);
    }
  }

  /** Add one AI suggestion to the list (keeps its quantity + reason). */
  function addSuggestion(s: ShoppingSuggestions["items"][number]) {
    const name = s.name.trim().toLowerCase();
    setSuggestions((prev) => prev?.filter((x) => x !== s) ?? null);
    if (items.some((i) => i.name === name)) return;
    const item: ShoppingItem = {
      id: crypto.randomUUID(),
      name,
      quantity_text: s.quantity,
      reason: s.reason,
      checked: false,
      created_at: new Date().toISOString(),
    };
    mutate(
      [item, ...items],
      [{ kind: "upsert", name, quantity_text: s.quantity, reason: s.reason, checked: false }]
    );
  }

  function addAllSuggestions() {
    if (!suggestions?.length) return;
    const fresh = suggestions.filter(
      (s) => !items.some((i) => i.name === s.name.trim().toLowerCase())
    );
    setSuggestions(null);
    if (!fresh.length) return;
    const now = new Date().toISOString();
    const newItems: ShoppingItem[] = fresh.map((s) => ({
      id: crypto.randomUUID(),
      name: s.name.trim().toLowerCase(),
      quantity_text: s.quantity,
      reason: s.reason,
      checked: false,
      created_at: now,
    }));
    mutate(
      [...newItems, ...items],
      newItems.map((i) => ({
        kind: "upsert" as const,
        name: i.name,
        quantity_text: i.quantity_text,
        reason: i.reason,
        checked: false,
      }))
    );
  }

  /** "I want to make Nashville hot chicken" — work out what that actually takes. */
  async function submitPlan(e: React.FormEvent) {
    e.preventDefault();
    const dish = planInput.trim();
    if (!dish || planning) return;
    setPlanning(true);
    setPlanError(false);
    setPlanCheck(null);
    try {
      const res = await fetch("/api/dish-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish }),
      });
      if (!res.ok) throw new Error("check failed");
      setPlanCheck(await res.json());
    } catch {
      setPlanError(true);
    } finally {
      setPlanning(false);
    }
  }

  /** "That's what I saw on TikTok" — guess the dish from a screenshot, drop it in the input to confirm. */
  async function onDishPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setRecognizing(true);
    setRecognizeError(false);
    setRecognizeNote(null);
    setPlanCheck(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/dish-recognize", { method: "POST", body: form });
      if (!res.ok) throw new Error("recognize failed");
      const result: DishRecognize = await res.json();
      setPlanInput(result.dish);
      setRecognizeNote(result);
    } catch {
      setRecognizeError(true);
    } finally {
      setRecognizing(false);
    }
  }

  /** Adds what's missing to the list and remembers the dish to cook later. */
  async function confirmPlan() {
    if (!planCheck) return;
    const check = planCheck;
    setPlanCheck(null);
    setPlanInput("");

    const { data } = await supabase
      .from("planned_meals")
      .insert({ user_id: userId, title: check.title, ingredients: check.ingredients })
      .select("id, title, ingredients, created_at")
      .single();
    if (data) setPlanned((prev) => [data as PlannedMeal, ...prev]);

    const missing = check.ingredients.filter(
      (i) => !i.have && !items.some((it) => it.name === i.item.trim().toLowerCase())
    );
    if (!missing.length) return;
    const now = new Date().toISOString();
    const newItems: ShoppingItem[] = missing.map((i) => ({
      id: crypto.randomUUID(),
      name: i.item.trim().toLowerCase(),
      quantity_text: i.amount,
      reason: `for ${check.title.toLowerCase()}`,
      checked: false,
      created_at: now,
    }));
    mutate(
      [...newItems, ...items],
      newItems.map((i) => ({
        kind: "upsert" as const,
        name: i.name,
        quantity_text: i.quantity_text,
        reason: i.reason,
        checked: false,
      }))
    );
  }

  async function removePlanned(meal: PlannedMeal) {
    setPlanned((prev) => prev.filter((m) => m.id !== meal.id));
    await supabase.from("planned_meals").delete().eq("id", meal.id);
  }

  async function startPlanned(meal: PlannedMeal) {
    setCooking(meal);
    setCookRecipe(null);
    setCookError(null);
    try {
      const missing = meal.ingredients.filter((i) => !i.have);
      const notes = missing.length
        ? `Still need to buy: ${missing.map((m) => `${m.item} (${m.amount})`).join(", ")}`
        : undefined;
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: meal.title, notes, mode: "authentic" }),
      });
      if (!res.ok) throw new Error("Couldn't write that recipe — try again.");
      setCookRecipe(await res.json());
    } catch (err) {
      setCooking(null);
      setCookError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function confirmStartCooking() {
    if (!cookRecipe || !cooking) return;
    setStartingCook(true);
    const { data, error } = await supabase
      .from("cook_sessions")
      .insert({ user_id: userId, recipe: cookRecipe, status: "active" })
      .select("id")
      .single();
    setStartingCook(false);
    if (error || !data) {
      setCookError(error?.message ?? "Couldn't start session");
      return;
    }
    await supabase.from("planned_meals").delete().eq("id", cooking.id);
    router.push(`/cook/${data.id}`);
  }

  const toBuy = items.filter((i) => !i.checked);
  const inBasket = items.filter((i) => i.checked);

  if (cooking) {
    return (
      <main className="page fade-in">
        {cookError ? (
          <div className="card" style={{ textAlign: "center", padding: 32 }}>
            <p style={{ color: "var(--red-warn)", marginBottom: 16 }}>{cookError}</p>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setCooking(null);
                setCookError(null);
              }}
            >
              Back to the list
            </button>
          </div>
        ) : !cookRecipe ? (
          <>
            <p className="page-sub" style={{ marginBottom: 12 }}>
              Writing your {cooking.title} recipe…
            </p>
            <RecipePreviewSkeleton />
          </>
        ) : (
          <RecipePreview
            recipe={cookRecipe}
            starting={startingCook}
            onStart={confirmStartCooking}
            onBack={() => {
              setCooking(null);
              setCookRecipe(null);
            }}
          />
        )}
      </main>
    );
  }

  return (
    <main className="page fade-in">
      <h1 className="page-title">Shopping list</h1>
      <p className="page-sub">
        {items.length
          ? `${toBuy.length} to buy${inBasket.length ? ` · ${inBasket.length} in the basket` : ""}`
          : "Nothing on the list yet — let Ember draft one from your pantry."}
      </p>

      {pending > 0 && (
        <p
          className="badge badge-warn"
          style={{ display: "inline-flex", marginBottom: 14 }}
        >
          {online ? (
            <>
              <RefreshCw /> syncing {pending} change{pending === 1 ? "" : "s"}…
            </>
          ) : (
            <>
              <WifiOff /> offline — {pending} change{pending === 1 ? "" : "s"} saved on this phone, will sync later
            </>
          )}
        </p>
      )}

      {/* Planning to cook — "I want to make X" drafts the list from a real dish */}
      <div className="card" style={{ marginBottom: 16, padding: "14px" }}>
        <p style={{ fontSize: "0.9rem", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
          <ChefHat size={16} style={{ color: "var(--ember-400)", flexShrink: 0 }} /> Planning to cook something?
        </p>
        <p style={{ color: "var(--text-faint)", fontSize: "0.78rem", marginBottom: 8 }}>
          Type it, or upload a screenshot of something you saw and want to make.
        </p>
        <input
          ref={dishPhotoRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onDishPhoto}
        />
        <form onSubmit={submitPlan} style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            placeholder="e.g. Nashville hot chicken"
            value={planInput}
            onChange={(e) => {
              setPlanInput(e.target.value);
              setRecognizeNote(null);
            }}
            disabled={planning || !online}
          />
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => dishPhotoRef.current?.click()}
            disabled={recognizing || !online}
            title="Identify the dish from a photo"
            aria-label="Identify the dish from a photo"
          >
            {recognizing ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Camera size={16} />}
          </button>
          <button
            className="btn btn-primary"
            type="submit"
            disabled={planning || !planInput.trim() || !online}
            title={online ? undefined : "Needs a connection"}
          >
            {planning ? <span className="spinner" style={{ width: 16, height: 16 }} /> : "Check it"}
          </button>
        </form>

        {recognizeNote && (
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 10 }}>
            Looks like <strong>{recognizeNote.dish}</strong> — {recognizeNote.description}
            {!recognizeNote.confident && " (not totally sure, double-check the name above)"}
          </p>
        )}

        {recognizeError && (
          <p style={{ color: "var(--red-warn)", fontSize: "0.85rem", marginTop: 10 }}>
            Couldn&apos;t make that out from the photo — try a clearer shot, or type the dish name?
          </p>
        )}

        {planError && (
          <p style={{ color: "var(--red-warn)", fontSize: "0.85rem", marginTop: 10 }}>
            Couldn&apos;t work that out — try again?
          </p>
        )}

        {planCheck && (
          <div className="fade-in" style={{ marginTop: 12 }}>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>{planCheck.title}</p>
            <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginBottom: 8 }}>
              {planCheck.ingredients.filter((i) => !i.have).length
                ? `Need to buy: ${planCheck.ingredients
                    .filter((i) => !i.have)
                    .map((i) => i.item)
                    .join(", ")}`
                : "You've already got everything for this one."}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={confirmPlan}>
                {planCheck.ingredients.some((i) => !i.have) ? "Add to my list" : "Plan it"}
              </button>
              <button className="btn btn-ghost" onClick={() => setPlanCheck(null)}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {planned.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginTop: planCheck ? 14 : 12 }}>
            {planned.map((meal) => {
              const missing = meal.ingredients.filter((i) => !i.have);
              return (
                <div
                  key={meal.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: "var(--radius)",
                    background: "var(--surface-2)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span>{meal.title}</span>
                    <div style={{ color: "var(--text-faint)", fontSize: "0.78rem" }}>
                      {missing.length ? `${missing.length} to buy` : "have everything"}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 12px", fontSize: "0.85rem", flexShrink: 0 }}
                    onClick={() => startPlanned(meal)}
                  >
                    <CookingPot size={14} /> cook it
                  </button>
                  <button
                    onClick={() => removePlanned(meal)}
                    style={{ color: "var(--text-faint)", padding: "4px 6px", display: "inline-flex" }}
                    aria-label={`Remove ${meal.title} from planned meals`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI-drafted list */}
      {!suggestions && !suggesting && (
        <button
          className={items.length ? "btn btn-ghost btn-full" : "btn btn-primary btn-full"}
          style={{ marginBottom: 16 }}
          onClick={suggest}
          disabled={!online}
          title={online ? undefined : "Needs a connection"}
        >
          <Sparkles /> Let Ember draft my list
        </button>
      )}

      {suggestError && (
        <p className="badge badge-warn" style={{ display: "inline-flex", marginBottom: 14 }}>
          Couldn&apos;t get suggestions — try again in a moment.
        </p>
      )}

      {suggesting && (
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="card"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}
            >
              <Skeleton width={24} height={24} radius="50%" />
              <div style={{ flex: 1, display: "grid", gap: 6 }}>
                <Skeleton width={`${45 + i * 10}%`} height="0.9em" />
                <Skeleton width="70%" height="0.7em" />
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestions && (
        <div className="card fade-in" style={{ marginBottom: 16, padding: "14px" }}>
          <p style={{ fontSize: "0.9rem", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
            <Sparkles size={16} style={{ color: "var(--ember-400)", flexShrink: 0 }} /> Based on your pantry, Ember suggests:
          </p>
          {suggestions.length === 0 ? (
            <p style={{ color: "var(--text-faint)", fontSize: "0.85rem" }}>
              Nothing to add — your pantry and list already look well stocked.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {suggestions.map((s) => (
                <div
                  key={s.name}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ textTransform: "capitalize" }}>{s.name}</span>
                    {s.quantity && (
                      <span
                        style={{ color: "var(--text-faint)", fontSize: "0.8rem", marginLeft: 8 }}
                      >
                        {s.quantity}
                      </span>
                    )}
                    <div style={{ color: "var(--text-faint)", fontSize: "0.75rem" }}>
                      {s.reason}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 12px", fontSize: "0.85rem", flexShrink: 0 }}
                    onClick={() => addSuggestion(s)}
                    aria-label={`Add ${s.name} to the list`}
                  >
                    + add
                  </button>
                  <button
                    onClick={() =>
                      setSuggestions((prev) => prev?.filter((x) => x !== s) ?? null)
                    }
                    style={{ color: "var(--text-faint)", padding: "4px 6px", display: "inline-flex" }}
                    aria-label={`Dismiss ${s.name}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {suggestions.length > 0 && (
              <button className="btn btn-primary" onClick={addAllSuggestions}>
                Add all {suggestions.length}
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setSuggestions(null)}>
              {suggestions.length > 0 ? "Dismiss" : "Close"}
            </button>
          </div>
        </div>
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
          <p style={{ fontSize: "0.9rem", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
            <ShoppingBasket size={16} style={{ color: "var(--amber-300)", flexShrink: 0 }} />
            <span>
              You&apos;ve already got <strong>{pantryWarn}</strong> in your pantry.
            </span>
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
              <ShoppingBasket size={14} /> have it
            </button>
            <button
              onClick={() => remove(item)}
              style={{ color: "var(--text-faint)", padding: "4px 6px", display: "inline-flex" }}
              aria-label={`Remove ${item.name}`}
            >
              <X size={17} />
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
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={15} strokeWidth={3} />
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
