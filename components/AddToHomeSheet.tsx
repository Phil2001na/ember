"use client";

import { Flame, MoreVertical, Plus, Share, SquarePlus, X } from "lucide-react";
import type { InstallPlatform } from "@/lib/installPlatform";

/** The Ember icon dropping onto a phone's home grid. */
function InstallAnimation() {
  return (
    <div className="a2hs-stage" aria-hidden="true">
      <div className="a2hs-phone">
        <div className="a2hs-grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="a2hs-slot" />
          ))}
          <span className="a2hs-slot target" />
        </div>
      </div>
      <span className="a2hs-icon">
        <Flame strokeWidth={2.4} />
      </span>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="a2hs-step">
      <span className="a2hs-step-n">{n}</span>
      <span>{children}</span>
    </li>
  );
}

function Glyph({ children }: { children: React.ReactNode }) {
  return <span className="a2hs-glyph">{children}</span>;
}

/** Per-platform taps. Android/desktop only reach these when the native prompt isn't offered. */
function Steps({ platform }: { platform: InstallPlatform }) {
  if (platform === "ios-safari") {
    return (
      <ol style={{ display: "grid", gap: 12 }}>
        <Step n={1}>
          Tap
          <Glyph>
            <Share />
          </Glyph>
          in the bar at the bottom of Safari.
        </Step>
        <Step n={2}>
          Scroll down and tap
          <Glyph>
            <SquarePlus />
          </Glyph>
          <strong>Add to Home Screen</strong>.
        </Step>
        <Step n={3}>
          Tap <strong>Add</strong> — Ember lands on your Home Screen like any other app.
        </Step>
      </ol>
    );
  }

  if (platform === "ios-other") {
    return (
      <ol style={{ display: "grid", gap: 12 }}>
        <Step n={1}>
          Open <strong>{typeof window === "undefined" ? "this page" : window.location.host}</strong>{" "}
          in <strong>Safari</strong> — on iPhone, only Safari can add apps to the Home Screen.
        </Step>
        <Step n={2}>
          Tap
          <Glyph>
            <Share />
          </Glyph>
          then <strong>Add to Home Screen</strong>.
        </Step>
        <Step n={3}>
          Tap <strong>Add</strong> and you&apos;re done.
        </Step>
      </ol>
    );
  }

  if (platform === "android") {
    return (
      <ol style={{ display: "grid", gap: 12 }}>
        <Step n={1}>
          Tap
          <Glyph>
            <MoreVertical />
          </Glyph>
          in the top-right of your browser.
        </Step>
        <Step n={2}>
          Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>).
        </Step>
        <Step n={3}>
          Confirm with <strong>Install</strong> — Ember appears in your app drawer.
        </Step>
      </ol>
    );
  }

  return (
    <ol style={{ display: "grid", gap: 12 }}>
      <Step n={1}>
        Look for
        <Glyph>
          <Plus />
        </Glyph>
        at the right-hand end of your browser&apos;s address bar.
      </Step>
      <Step n={2}>
        Click it, then click <strong>Install</strong>.
      </Step>
      <Step n={3}>Ember opens in its own window, without the browser chrome.</Step>
    </ol>
  );
}

const WHY: Record<InstallPlatform, string> = {
  "ios-safari": "Full screen, no address bar, and one tap from your Home Screen.",
  "ios-other": "Full screen, no address bar, and one tap from your Home Screen.",
  android: "Full screen, one tap from your home screen, and timer alerts work better.",
  desktop: "Its own window, no browser chrome, one click from your dock.",
};

export default function AddToHomeSheet({
  platform,
  canPromptNatively,
  installing,
  onInstall,
  onClose,
}: {
  platform: InstallPlatform;
  /** Chromium gave us a real install event, so we can skip the manual steps. */
  canPromptNatively: boolean;
  installing: boolean;
  onInstall: () => void;
  onClose: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "88dvh" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 18px 0",
            flexShrink: 0,
          }}
        >
          <h3 style={{ fontSize: "1.05rem" }}>Keep Ember one tap away</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            overflowY: "auto",
            padding: "4px 18px calc(20px + env(safe-area-inset-bottom))",
          }}
        >
          <InstallAnimation />

          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "0.88rem",
              textAlign: "center",
              margin: "0 0 20px",
            }}
          >
            {WHY[platform]}
          </p>

          {canPromptNatively ? (
            <button
              className="btn btn-primary btn-full"
              style={{ padding: "15px 20px" }}
              onClick={onInstall}
              disabled={installing}
            >
              {installing ? (
                <>
                  <span className="spinner" /> Installing…
                </>
              ) : (
                <>
                  <Plus /> Add Ember to my Home Screen
                </>
              )}
            </button>
          ) : (
            <Steps platform={platform} />
          )}

          <button className="btn btn-ghost btn-full" style={{ marginTop: 14 }} onClick={onClose}>
            {canPromptNatively ? "Not now" : "Got it"}
          </button>
        </div>
      </div>
    </div>
  );
}
