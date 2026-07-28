"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Smartphone } from "lucide-react";
import {
  detectPlatform,
  isStandalone,
  type BeforeInstallPromptEvent,
  type InstallPlatform,
} from "@/lib/installPlatform";
import AddToHomeSheet from "@/components/AddToHomeSheet";

/**
 * Asks people to install Ember at the one moment they've just seen it work —
 * the end of a cook. Deliberately not a modal: it sits in the finish screen's
 * existing row-card stack, and only opens the guide when tapped.
 *
 * Nagging is the failure mode here, so: hidden once installed, and after two
 * ignored cooks it never asks again.
 */
const ASKS_KEY = "ember-a2hs-asks";
const LAST_KEY = "ember-a2hs-last-cook";
const MAX_ASKS = 2;

function askCount(): number {
  try {
    return Number(localStorage.getItem(ASKS_KEY) ?? 0);
  } catch {
    return MAX_ASKS; // storage blocked — treat as "don't ask"
  }
}

/**
 * Counts one ask per *cook*, not per render — revisiting or reloading a finished
 * cook shouldn't burn the budget. Returns false if this cook was already counted.
 */
function recordAsk(occasionId: string): boolean {
  try {
    if (localStorage.getItem(LAST_KEY) === occasionId) return false;
    localStorage.setItem(LAST_KEY, occasionId);
    localStorage.setItem(ASKS_KEY, String(askCount() + 1));
  } catch {}
  return true;
}

function stopAsking() {
  try {
    localStorage.setItem(ASKS_KEY, String(MAX_ASKS));
  } catch {}
}

export default function AddToHome({ occasionId }: { occasionId: string }) {
  // null until the client-only checks (storage, UA, display-mode) have run
  const [platform, setPlatform] = useState<InstallPlatform | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    // a cook already counted stays visible on revisit; a new one has to fit the budget
    const alreadyCounted = localStorage.getItem(LAST_KEY) === occasionId;
    if (!alreadyCounted && askCount() >= MAX_ASKS) return;
    recordAsk(occasionId);
    setPlatform(detectPlatform());
  }, [occasionId]);

  // Chromium offers the real install dialog, but only if we intercept its event
  // and hold onto it — it can't be re-fired later from scratch.
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      stopAsking();
      setPlatform(null);
      setSheetOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installEvent) return;
    setInstalling(true);
    try {
      await installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === "accepted") stopAsking();
      // the event is single-use either way
      setInstallEvent(null);
      setSheetOpen(false);
    } catch {
      // let them fall back to the manual steps
      setInstallEvent(null);
    } finally {
      setInstalling(false);
    }
  }

  if (!platform) return null;

  return (
    <>
      <button
        className="card row-card fade-in"
        style={{ marginBottom: 16 }}
        onClick={() => setSheetOpen(true)}
      >
        <span className="row-card-icon">
          <Smartphone />
        </span>
        <div style={{ flex: 1 }}>
          <h3>Add Ember to your Home Screen</h3>
          <p>Open it like a real app — no browser, no typing the address</p>
        </div>
        <ChevronRight size={19} style={{ color: "var(--text-faint)" }} />
      </button>

      {sheetOpen && (
        <AddToHomeSheet
          platform={platform}
          canPromptNatively={!!installEvent}
          installing={installing}
          onInstall={install}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
