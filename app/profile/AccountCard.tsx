"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, LogOut, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string | null;
  isAnonymous: boolean;
  emailConfirmed: boolean;
};

/**
 * The light way to keep a kitchen: a name and a secret, no inbox involved.
 * Same shape as Fitness's account-recovery card, deliberately, since the two
 * apps are meant to feel like one identity even though each keeps its own
 * anonymous session.
 */
function NameKitchen() {
  const supabase = useMemo(() => createClient(), []);
  const [current, setCurrent] = useState<string | null>(null);
  const [open, setOpen] = useState<"idle" | "name" | "claim">("idle");
  const [handle, setHandleValue] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("my_handle").then(({ data }) => setCurrent((data as string | null) ?? null));
  }, [supabase]);

  async function save() {
    setBusy(true);
    setNote(null);
    const { data, error } = await supabase.rpc("set_handle", { p_handle: handle, p_secret: secret });
    setBusy(false);
    if (error) return setNote(error.message);
    setCurrent((data as { handle: string }).handle);
    setOpen("idle");
    setSecret("");
    setNote(`Saved. "${(data as { handle: string }).handle}" plus that secret brings this kitchen back on any device.`);
  }

  async function claim() {
    setBusy(true);
    setNote(null);
    const { data, error } = await supabase.rpc("claim_handle", { p_handle: handle, p_secret: secret });
    setBusy(false);
    if (error) return setNote(error.message);
    const result = data as { moved: number; already_yours?: boolean };
    if (result.already_yours) return setNote("This is already the kitchen you're on.");
    setOpen("idle");
    setHandleValue("");
    setSecret("");
    window.location.reload();
  }

  return (
    <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <User size={16} style={{ color: "var(--accent-icon)" }} />
        {current ? `This kitchen is "${current}".` : "Name this kitchen."}
      </p>
      <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
        {current
          ? "That name and secret pull your pantry and recipes onto a new device."
          : "A name and a secret — enough to get your pantry back if you lose this device, no email needed."}
      </p>
      {open !== "idle" && (
        <>
          <input
            className="input" type="text" autoCapitalize="none" placeholder="kitchen name"
            value={handle} onChange={(e) => setHandleValue(e.target.value)}
          />
          <input
            className="input" type="password" placeholder="secret (6+ characters)"
            value={secret} onChange={(e) => setSecret(e.target.value)}
          />
        </>
      )}
      {note && <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>{note}</p>}
      {open === "idle" && (
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-primary btn-full" onClick={() => { setHandleValue(current ?? ""); setOpen("name"); }}>
            {current ? "Change name" : "Name it"}
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => { setHandleValue(""); setOpen("claim"); }}>
            I&rsquo;ve been here before
          </button>
        </div>
      )}
      {open === "name" && (
        <button className="btn btn-primary btn-full" disabled={busy || handle.trim().length < 2 || secret.length < 6} onClick={save}>
          {busy ? "…" : "Save name"}
        </button>
      )}
      {open === "claim" && (
        <button className="btn btn-primary btn-full" disabled={busy || handle.trim().length < 2 || secret.length < 6} onClick={claim}>
          {busy ? "…" : "Get my kitchen back"}
        </button>
      )}
      {open !== "idle" && (
        <button className="btn btn-ghost btn-full" onClick={() => { setOpen("idle"); setNote(null); }}>
          Cancel
        </button>
      )}
    </div>
  );
}

export default function AccountCard({ email, isAnonymous, emailConfirmed }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"idle" | "link" | "signin">("idle");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Linked and confirmed — just show the account.
  if (!isAnonymous && emailConfirmed) {
    return (
      <>
        <NameKitchen />
        <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Mail size={16} style={{ color: "var(--accent-icon)" }} /> {email}
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            Your kitchen is saved to this account. Sign in with it on any device.
          </p>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              router.refresh();
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </>
    );
  }

  // Email attached but confirmation link not clicked yet.
  if (email && !emailConfirmed) {
    return (
      <>
        <NameKitchen />
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Mail size={16} style={{ color: "var(--accent-amber)" }} /> {email}
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 6 }}>
            Check your inbox and tap the confirmation link to finish saving your
            kitchen to this email.
          </p>
        </div>
      </>
    );
  }

  async function linkEmail() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.updateUser(
      { email: formEmail, password: formPassword },
      { emailRedirectTo: `${window.location.origin}/auth/confirmed` }
    );
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
      router.refresh();
    }
  }

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: formEmail,
      password: formPassword,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      router.refresh();
    }
  }

  if (sent) {
    return (
      <>
        <NameKitchen />
        <div className="card" style={{ marginTop: 12 }}>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
            Confirmation sent to <strong>{formEmail}</strong> — tap the link in
            that email and your kitchen is saved.
          </p>
        </div>
      </>
    );
  }

  if (mode === "idle") {
    return (
      <>
        <NameKitchen />
        <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
            Save your kitchen by email instead
          </p>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            Heavier than a name and secret, but works across any device without
            remembering a handle.
          </p>
          <button className="btn btn-ghost btn-full" onClick={() => setMode("link")}>
            <Mail size={16} /> Add email
          </button>
          <button className="btn btn-ghost btn-full" onClick={() => setMode("signin")}>
            I already have an account
          </button>
        </div>
      </>
    );
  }

  const isLink = mode === "link";
  return (
    <>
      <NameKitchen />
      <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
          {isLink ? "Save your kitchen" : "Sign in"}
        </p>
        {!isLink && (
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
            Signing in switches this device to your saved kitchen — anything
            cooked here without an account stays behind.
          </p>
        )}
        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={formEmail}
          onChange={(e) => setFormEmail(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder={isLink ? "Choose a password (6+ characters)" : "Password"}
          autoComplete={isLink ? "new-password" : "current-password"}
          value={formPassword}
          onChange={(e) => setFormPassword(e.target.value)}
        />
        {error && (
          <p style={{ color: "var(--red-warn)", fontSize: "0.85rem" }}>{error}</p>
        )}
        <button
          className="btn btn-primary btn-full"
          disabled={busy || !formEmail || formPassword.length < 6}
          onClick={isLink ? linkEmail : signIn}
        >
          {busy ? "…" : isLink ? "Save my kitchen" : "Sign in"}
        </button>
        <button className="btn btn-ghost btn-full" onClick={() => { setMode("idle"); setError(null); }}>
          Cancel
        </button>
      </div>
    </>
  );
}
