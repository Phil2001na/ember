"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SunMoon, X } from "lucide-react";

const SEEN_KEY = "ember-theme-announced";

export default function ThemeAnnouncement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(SEEN_KEY)) {
      localStorage.setItem(SEEN_KEY, "1");
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="card fade-in"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", margin: "0 18px 10px" }}
    >
      <SunMoon size={19} style={{ color: "var(--accent-icon)", flexShrink: 0 }} />
      <p style={{ flex: 1, fontSize: "0.83rem", color: "var(--text-dim)" }}>
        Ember now has a light mode —{" "}
        <Link
          href="/settings"
          style={{ color: "var(--accent-icon-soft)", textDecoration: "underline" }}
          onClick={() => setVisible(false)}
        >
          switch it in Settings
        </Link>
        .
      </p>
      <button
        className="icon-btn"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
        style={{ flexShrink: 0, width: 30, height: 30 }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
