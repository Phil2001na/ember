"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Appearance">
      <button
        type="button"
        role="radio"
        aria-checked={theme === "dark"}
        className={`theme-toggle-btn${theme === "dark" ? " active" : ""}`}
        onClick={() => setTheme("dark")}
      >
        <Moon size={16} /> Dark
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === "light"}
        className={`theme-toggle-btn${theme === "light" ? " active" : ""}`}
        onClick={() => setTheme("light")}
      >
        <Sun size={16} /> Light
      </button>
    </div>
  );
}
