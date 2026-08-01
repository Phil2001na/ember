"use client";

import { useEffect, useState } from "react";
import { Activity, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function FitnessConnection() {
  const supabase = createClient();
  const [loaded, setLoaded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setUserId(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("fitness_auto_log")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setEnabled(!!data?.fitness_auto_log);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function toggle() {
    if (!userId || busy) return;
    const next = !enabled;
    setBusy(true);
    setEnabled(next);
    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, fitness_auto_log: next });
    setBusy(false);
    if (error) setEnabled(!next);
  }

  if (!loaded) return null;

  return (
    <button
      type="button"
      className="card row-card"
      onClick={toggle}
      disabled={busy}
      aria-pressed={enabled}
    >
      <span
        className="row-card-icon"
        style={enabled ? { borderColor: "var(--green-ok)", color: "var(--green-ok)" } : undefined}
      >
        <Activity />
      </span>
      <div style={{ flex: 1 }}>
        <h3>Log meals to Fitness</h3>
        <p>
          {enabled
            ? "Every cook you finish here logs back to Fitness automatically."
            : "Off — finishing a cook stays inside Ember only."}
        </p>
      </div>
      {enabled && <Check size={19} style={{ color: "var(--green-ok)" }} />}
    </button>
  );
}
