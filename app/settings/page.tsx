"use client";

import Link from "next/link";
import { Activity, ChevronLeft, Palette } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import FitnessConnection from "@/components/FitnessConnection";

export default function SettingsPage() {
  return (
    <main className="page fade-in">
      <Link href="/profile" className="icon-btn" style={{ marginBottom: 8 }} aria-label="Back">
        <ChevronLeft />
      </Link>
      <h1 className="page-title">Settings</h1>
      <p className="page-sub">Make Ember yours.</p>

      <div className="section-head">
        <Palette /> Appearance
      </div>
      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ color: "var(--text-dim)", fontSize: "0.88rem", marginBottom: 14 }}>
          Choose how Ember looks on this device.
        </p>
        <ThemeToggle />
      </div>

      {process.env.NEXT_PUBLIC_FITNESS_URL && (
        <>
          <div className="section-head">
            <Activity /> Fitness
          </div>
          <FitnessConnection />
        </>
      )}
    </main>
  );
}
