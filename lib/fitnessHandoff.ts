import type { Recipe } from "@/lib/schemas";

/* ─── Inbound: Fitness → Ember ─── */

export type NutritionIntentV1 = {
  version: 1 | 2;
  requestId: string;
  goal: "gain" | "maintain" | "lighter";
  need: "small" | "moderate" | "substantial";
  appetite?: "low" | "normal" | "high";
  proteinPreferred?: boolean;
  timeMinutes?: number;
  /** V2 — roughly how much energy this meal should carry. Ember never shows these. */
  kcalTarget?: number;
  proteinTargetG?: number;
  /** V2 — a dish already picked in Fitness; skip suggestions, go straight to it. */
  dish?: string;
  nudgeId?: string;
  /** V4 — a recipe already generated at planning time; skip generation entirely. */
  recipeId?: string;
};

const GOALS = ["gain", "maintain", "lighter"] as const;
const NEEDS = ["small", "moderate", "substantial"] as const;
const APPETITES = ["low", "normal", "high"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export type IntentParseResult =
  | { ok: true; intent: NutritionIntentV1 }
  | { ok: false; reason: string };

/** Parses and defensively validates the `/from/fitness` query contract. */
export function parseNutritionIntent(
  searchParams: Record<string, string | string[] | undefined>
): IntentParseResult {
  const v = first(searchParams.v);
  if (v !== "1" && v !== "2") return { ok: false, reason: "unsupported-version" };

  const requestId = first(searchParams.request_id);
  if (!requestId || !UUID_RE.test(requestId)) return { ok: false, reason: "invalid-request-id" };

  const goal = first(searchParams.goal);
  if (!goal || !GOALS.includes(goal as NutritionIntentV1["goal"]))
    return { ok: false, reason: "invalid-goal" };

  const need = first(searchParams.need);
  if (!need || !NEEDS.includes(need as NutritionIntentV1["need"]))
    return { ok: false, reason: "invalid-need" };

  const appetiteRaw = first(searchParams.appetite);
  if (appetiteRaw !== undefined && !APPETITES.includes(appetiteRaw as NutritionIntentV1["appetite"] & string))
    return { ok: false, reason: "invalid-appetite" };

  const proteinRaw = first(searchParams.protein_preferred);
  if (proteinRaw !== undefined && proteinRaw !== "1" && proteinRaw !== "0")
    return { ok: false, reason: "invalid-protein-preferred" };

  const timeRaw = first(searchParams.time_minutes);
  let timeMinutes: number | undefined;
  if (timeRaw !== undefined) {
    const n = Number(timeRaw);
    if (!Number.isInteger(n) || n <= 0 || n > 240) return { ok: false, reason: "invalid-time-minutes" };
    timeMinutes = n;
  }

  const clampInt = (raw: string | undefined, min: number, max: number) => {
    if (raw === undefined) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  const dish = first(searchParams.dish)?.slice(0, 120);
  const nudgeId = first(searchParams.nudge_id);
  const recipeId = first(searchParams.recipe_id);

  return {
    ok: true,
    intent: {
      version: v === "2" ? 2 : 1,
      requestId,
      goal: goal as NutritionIntentV1["goal"],
      need: need as NutritionIntentV1["need"],
      ...(appetiteRaw !== undefined ? { appetite: appetiteRaw as NutritionIntentV1["appetite"] } : {}),
      ...(proteinRaw !== undefined ? { proteinPreferred: proteinRaw === "1" } : {}),
      ...(timeMinutes !== undefined ? { timeMinutes } : {}),
      ...(clampInt(first(searchParams.kcal_target), 50, 3000) !== undefined
        ? { kcalTarget: clampInt(first(searchParams.kcal_target), 50, 3000) }
        : {}),
      ...(clampInt(first(searchParams.protein_target), 0, 300) !== undefined
        ? { proteinTargetG: clampInt(first(searchParams.protein_target), 0, 300) }
        : {}),
      ...(dish ? { dish } : {}),
      ...(nudgeId && UUID_RE.test(nudgeId) ? { nudgeId } : {}),
      // An invalid/guessed id just falls back to the normal dish/generation
      // path rather than failing the whole handoff.
      ...(recipeId && UUID_RE.test(recipeId) ? { recipeId } : {}),
    },
  };
}

const NEED_PHRASE: Record<NutritionIntentV1["need"], string> = {
  small: "a small bite",
  moderate: "a moderate meal",
  substantial: "something substantial",
};

const GOAL_PHRASE: Record<NutritionIntentV1["goal"], string> = {
  gain: "something that'll help you build up",
  maintain: "something to keep you steady",
  lighter: "something on the lighter side",
};

/** Subtle, non-numeric attribution line shown in the Ember UI. */
export function describeIntent(intent: NutritionIntentV1): string {
  const bits = [NEED_PHRASE[intent.need]];
  if (intent.proteinPreferred) bits.push("protein-forward");
  return `Fitness says today could use ${bits.join(", ")}.`;
}

/** Natural-language nudge fed into Ember's existing pantry-aware suggestion flow. */
export function intentToCraving(intent: NutritionIntentV1): string {
  const parts = [NEED_PHRASE[intent.need], GOAL_PHRASE[intent.goal]];
  if (intent.proteinPreferred) parts.push("ideally protein-forward");
  if (intent.appetite === "low") parts.push("nothing too heavy, appetite is low today");
  if (intent.appetite === "high") parts.push("they're properly hungry");
  if (intent.timeMinutes) parts.push(`ready in about ${intent.timeMinutes} minutes or less`);
  // V2 carries a rough energy figure. It shapes the portion, but it must never
  // surface in what Ember says — Ember talks about food, not numbers.
  if (intent.kcalTarget) {
    parts.push(
      intent.kcalTarget >= 800
        ? "a properly generous, filling portion"
        : intent.kcalTarget >= 500
          ? "a normal full plate"
          : "a modest portion"
    );
  }
  return `${parts.join(", ")}. Do not mention calories, macros, or exact nutrition numbers.`;
}

/* ─── Outbound: Ember → Fitness ─── */

export type MealOutcomeV1 = {
  version: 1 | 2;
  requestId: string;
  eaten: boolean;
  size: "snack" | "light_meal" | "full_meal";
  proteinAnchor: boolean;
  energyBand?: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  /** V2 — rough working numbers for the Fitness ledger. */
  kcal?: number;
  proteinG?: number;
  title?: string;
};

const PROTEIN_KEYWORDS =
  /chicken|beef|pork|lamb|fish|salmon|tuna|shrimp|prawn|egg|tofu|tempeh|bean|lentil|chickpea|yogurt|yoghurt|cheese|mince|steak|turkey|paneer|protein/i;

/**
 * Best-effort outcome derived from the recipe actually cooked — no extra prompts.
 *
 * `kcalHint` is what Fitness asked for (or what the suggestion was estimated at)
 * when the cook started. Ember doesn't compute nutrition; passing the hint back
 * is honest — it says "roughly the meal you asked for" — and it's what makes the
 * ledger close the loop without nagging the user for numbers.
 */
export function inferMealOutcome(
  recipe: Recipe,
  requestId: string,
  hints?: { kcal?: number; proteinG?: number }
): MealOutcomeV1 {
  const size: MealOutcomeV1["size"] =
    recipe.time_minutes <= 15 ? "snack" : recipe.time_minutes <= 45 ? "light_meal" : "full_meal";
  const proteinAnchor = recipe.ingredients.some((i) => PROTEIN_KEYWORDS.test(i.item));
  const kcal = hints?.kcal ?? (size === "snack" ? 250 : size === "light_meal" ? 550 : 800);
  const proteinG = hints?.proteinG ?? (proteinAnchor ? Math.round(kcal / 18) : Math.round(kcal / 40));

  return {
    version: 2,
    requestId,
    eaten: true,
    size,
    proteinAnchor,
    confidence: hints?.kcal ? "medium" : "low",
    kcal,
    proteinG,
    title: recipe.title,
  };
}

/**
 * Builds the allowlisted return URL to Fitness. Returns null when
 * NEXT_PUBLIC_FITNESS_URL isn't configured — callers must degrade gracefully
 * (no button) rather than show a dead link. Never accepts a caller-supplied base.
 */
export function buildFitnessReturnUrl(outcome: MealOutcomeV1): string | null {
  const base = process.env.NEXT_PUBLIC_FITNESS_URL;
  if (!base) return null;

  let url: URL;
  try {
    url = new URL("/nutrition/ember", base);
  } catch {
    return null;
  }

  const v2 = outcome.version === 2 || outcome.kcal !== undefined;

  url.searchParams.set("v", v2 ? "2" : "1");
  url.searchParams.set("request_id", outcome.requestId);
  url.searchParams.set("eaten", outcome.eaten ? "1" : "0");
  url.searchParams.set("size", outcome.size);
  url.searchParams.set("protein_anchor", outcome.proteinAnchor ? "1" : "0");
  if (outcome.energyBand) url.searchParams.set("energy_band", outcome.energyBand);
  url.searchParams.set("confidence", outcome.confidence);
  if (v2) {
    if (outcome.kcal !== undefined) url.searchParams.set("kcal", String(Math.round(outcome.kcal)));
    if (outcome.proteinG !== undefined)
      url.searchParams.set("protein_g", String(Math.round(outcome.proteinG)));
    if (outcome.title) url.searchParams.set("title", outcome.title.slice(0, 120));
  }
  return url.toString();
}
