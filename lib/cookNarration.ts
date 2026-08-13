import type { Recipe, RecipeStep } from "@/lib/schemas";

/* Voice mode narration, built straight from the recipe JSON — no model call.
   Every step already carries instruction / heat / oven_temp_c / timer_min /
   watch_for, so reading a step aloud and deciding what to wait for is pure
   rendering. The model is only worth spending on real questions. */

export type Gate =
  /** Something has to happen before the clock should start ("say go when the pan's hot"). */
  | { kind: "ready"; hint: string; timerMin: number }
  /** No timer, but a doneness cue to watch for. */
  | { kind: "cue"; hint: string }
  /** Nothing to wait on — just move when they're done. */
  | { kind: "open"; hint: string };

const HEAT_SPOKEN: Record<string, string> = {
  off: "heat off",
  low: "low heat",
  "medium-low": "medium-low heat",
  medium: "medium heat",
  "medium-high": "medium-high heat",
  high: "high heat",
};

export function gateFor(step: RecipeStep): Gate {
  if (step.timer_min) {
    return {
      kind: "ready",
      hint: `say “go” to start ${spokenDuration(step.timer_min)}`,
      timerMin: step.timer_min,
    };
  }
  if (step.watch_for) return { kind: "cue", hint: "say “next” when you're there" };
  return { kind: "open", hint: "say “next” when you're done" };
}

/** "4 minutes", "30 seconds", "1 minute 30" — spoken, not "4.5 min". */
export function spokenDuration(minutes: number): string {
  const total = Math.round(minutes * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (!m) return `${s} seconds`;
  const mins = `${m} ${m === 1 ? "minute" : "minutes"}`;
  return s ? `${mins} ${s}` : mins;
}

function heatLine(step: RecipeStep): string {
  if (step.oven_temp_c) return `Oven at ${step.oven_temp_c} degrees.`;
  if (step.heat && step.heat !== "off") return `${cap(HEAT_SPOKEN[step.heat])}.`;
  return "";
}

function cap(s: string) {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Deliberately short — this is the line that replaces looking at the phone. */
export function narrateStep(
  step: RecipeStep,
  idx: number,
  total: number,
  gate: Gate
): string {
  const parts = [`Step ${idx + 1} of ${total}.`, step.instruction.trim(), heatLine(step)];

  if (gate.kind === "ready") {
    parts.push(`When you're ready, say go and I'll start ${spokenDuration(gate.timerMin)}.`);
  } else if (gate.kind === "cue" && step.watch_for) {
    // spoken verbatim, no "watch for" lead-in: the cue is sometimes a noun
    // phrase ("the edges turning golden") and sometimes already a full
    // sentence ("it should taste balanced"), and no prefix fits both
    parts.push(cap(step.watch_for), "Say next when you're there.");
  } else {
    parts.push("Say next when you're done.");
  }

  return parts.filter(Boolean).map(sentence).join(" ");
}

export function narrateTimerDone(step: RecipeStep | undefined, label: string): string {
  const parts = [`Time's up on ${label}.`];
  if (step?.watch_for) parts.push(cap(step.watch_for));
  parts.push("Say next when you're ready to move on.");
  return parts.map(sentence).join(" ");
}

/* Vocabulary sent to the transcriber to bias it. Short utterances over pan
   noise are the hardest case for a general speech model and the easiest to
   fix with context: it needs to know that "go" is a word we expect and that
   "za'atar" is a thing that might be said. */
export function transcriptionHint(recipe: Recipe): string {
  const items = recipe.ingredients
    .map((i) => i.item)
    .filter(Boolean)
    .slice(0, 18)
    .join(", ");
  return `Cooking ${recipe.title}. Ingredients: ${items}. Spoken commands: next, back, repeat, go, ready, pause, resume, how long, ingredients, details.`;
}

export function narrateIngredients(recipe: Recipe): string {
  const list = recipe.ingredients
    .map((i) => [i.amount, i.item].filter(Boolean).join(" "))
    .join(", ");
  return `You need ${list}.`;
}

export function narrateTimeLeft(remainingSec: number, label: string): string {
  if (remainingSec <= 0) return `${cap(label)} is already done.`;
  const m = Math.floor(remainingSec / 60);
  const s = remainingSec % 60;
  const said = m ? `${m} ${m === 1 ? "minute" : "minutes"}${s ? ` and ${s} seconds` : ""}` : `${s} seconds`;
  return `${said} left on ${label}.`;
}

function sentence(s: string) {
  const t = s.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}
