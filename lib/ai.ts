import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// One cost-efficient GPT model for coaching, structured recipe work, and vision
// (only provider with credit right now — see UPDATES.md 2026-08-06).
export const brain = openai("gpt-5.6-luna");
export const eyes = brain;

// "high" reasoning effort measured ~68s on a full recipe generation — close
// enough to the 60-90s route maxDuration to risk a platform timeout under any
// extra latency (cold start, longer prompt, network jitter). "medium" measured
// ~20s on the same prompt with no visible quality loss for this kind of
// structured writing task, so that's the default everywhere.
export const reasoningEffort = { openai: { reasoningEffort: "medium" as const } };
