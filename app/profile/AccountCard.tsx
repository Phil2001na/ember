"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string | null;
  isAnonymous: boolean;
  emailConfirmed: boolean;
};

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
    );
  }

  // Email attached but confirmation link not clicked yet.
  if (email && !emailConfirmed) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <p style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Mail size={16} style={{ color: "var(--accent-amber)" }} /> {email}
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem", marginTop: 6 }}>
          Check your inbox and tap the confirmation link to finish saving your
          kitchen to this email.
        </p>
      </div>
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
      <div className="card" style={{ marginTop: 12 }}>
        <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
          Confirmation sent to <strong>{formEmail}</strong> — tap the link in
          that email and your kitchen is saved.
        </p>
      </div>
    );
  }

  if (mode === "idle") {
    return (
      <div className="card" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
          Save your kitchen
        </p>
        <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>
          Right now your recipes and pantry live only on this device. Add an
          email to keep them if you switch phones or reinstall.
        </p>
        <button className="btn btn-primary btn-full" onClick={() => setMode("link")}>
          <Mail size={16} /> Add email
        </button>
        <button className="btn btn-ghost btn-full" onClick={() => setMode("signin")}>
          I already have an account
        </button>
      </div>
    );
  }

  const isLink = mode === "link";
  return (
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
  );
}
