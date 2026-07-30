import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });

// The cook brain (suggestions, recipes, live coaching).
// Claude Sonnet is the intended brain; BRAIN=gemini is the stopgap for when
// Anthropic credits run dry (same trick as the Keeper).
export const brain =
  process.env.BRAIN === "gemini"
    ? google("gemini-2.5-pro")
    : anthropic("claude-sonnet-5");

// Gemini = eyes (pantry photo → ingredients)
export const eyes = google("gemini-2.5-flash");

// The other provider, for unattended jobs that must not fail just because one
// account's credits ran out (the Fitness nutrition integration runs with nobody
// watching, so it retries on this before giving up).
export const spareBrain =
  process.env.BRAIN === "gemini" ? anthropic("claude-sonnet-5") : google("gemini-2.5-pro");
