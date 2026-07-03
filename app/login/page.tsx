"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setStage("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/");
    router.refresh();
  }

  return (
    <main
      className="page fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "100dvh",
        gap: 16,
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: "3rem" }}>🔥</div>
        <h1 style={{ fontSize: "2.2rem" }}>Ember</h1>
        <p className="page-sub" style={{ marginBottom: 0 }}>
          Your kitchen knows what&apos;s for dinner.
        </p>
      </div>

      {stage === "email" ? (
        <form onSubmit={sendCode} style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn btn-primary btn-full" disabled={busy}>
            {busy ? <span className="spinner" /> : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} style={{ display: "grid", gap: 12 }}>
          <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", textAlign: "center" }}>
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
          <input
            className="input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ textAlign: "center", letterSpacing: "0.4em", fontSize: "1.3rem" }}
            required
          />
          <button className="btn btn-primary btn-full" disabled={busy}>
            {busy ? <span className="spinner" /> : "Let's cook"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-full"
            onClick={() => setStage("email")}
          >
            Different email
          </button>
        </form>
      )}

      {error && (
        <p style={{ color: "var(--red-warn)", fontSize: "0.9rem", textAlign: "center" }}>
          {error}
        </p>
      )}
    </main>
  );
}
