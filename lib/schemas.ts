import { z } from "zod";

/* ─── Pantry vision (Gemini) ─── */

export const VisionResultSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe("Ingredient name, singular, lowercase, e.g. 'tomato paste'"),
      quantity_estimate: z
        .string()
        .describe("Rough human quantity, e.g. 'half a bag', '3', 'almost empty'"),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),
});
export type VisionResult = z.infer<typeof VisionResultSchema>;

/* ─── Suggestions (Claude) ─── */

export const SuggestionSchema = z.object({
  title: z.string(),
  description: z.string().describe("One appetizing sentence about the dish"),
  time_minutes: z.number(),
  difficulty: z.enum(["easy", "medium", "challenge"]),
  match: z.enum(["have-everything", "missing-few"]),
  missing: z.array(
    z.object({
      item: z.string(),
      substitution: z
        .string()
        .nullable()
        .describe("A workable substitute from the pantry, or null if truly needed"),
    })
  ),
});
export const SuggestionsSchema = z.object({
  suggestions: z.array(SuggestionSchema).describe("3 to 5 suggestions"),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

/* ─── Pantry update (kitchen-chat tool) ─── */

export const PantryUpdateSchema = z.object({
  add: z
    .array(z.string())
    .describe("Ingredient names to add to the pantry, lowercase, singular, e.g. 'egg'"),
  remove: z
    .array(z.string())
    .describe("EXACT pantry item names to remove because they're finished or gone off"),
});
export type PantryUpdate = z.infer<typeof PantryUpdateSchema>;

/* ─── Shopping list update (kitchen-chat tool) ─── */

export const ShoppingListUpdateSchema = z.object({
  add: z
    .array(
      z.object({
        name: z.string().describe("Item to buy, lowercase, singular, e.g. 'parmesan'"),
        quantity: z
          .string()
          .nullable()
          .describe("How much to buy if known, e.g. '500g', '2 tins', else null"),
        reason: z
          .string()
          .nullable()
          .describe("Short why, e.g. 'for lasagna', null if none"),
      })
    )
    .describe("Items to add to the shopping list — never items already in the pantry"),
  remove: z
    .array(z.string())
    .describe("EXACT shopping list item names to remove (bought, or no longer needed)"),
});
export type ShoppingListUpdate = z.infer<typeof ShoppingListUpdateSchema>;

/* ─── Shopping suggestions (AI-drafted list) ─── */

export const ShoppingSuggestionsSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().describe("Item to buy, lowercase, singular, e.g. 'parmesan'"),
        quantity: z
          .string()
          .nullable()
          .describe("Sensible amount to buy, e.g. '500g', '1 bottle', else null"),
        reason: z
          .string()
          .describe(
            "Short, concrete why — e.g. 'running low', 'unlocks a quick chicken stir-fry with your peppers'"
          ),
      })
    )
    .describe("5 to 10 suggested items, most useful first"),
});
export type ShoppingSuggestions = z.infer<typeof ShoppingSuggestionsSchema>;

/* ─── Used-up check (after a cook) ─── */

export const UsedUpSchema = z.object({
  used_up: z
    .array(z.string())
    .describe("EXACT pantry item names that were likely finished off by this cook"),
});

/* ─── Dish check (Claude) — "I want to cook X" ─── */

export const DishCheckSchema = z.object({
  title: z.string().describe("The normalized, confirmed name of the dish"),
  description: z.string().describe("One appetizing sentence about the dish"),
  time_minutes: z.number(),
  difficulty: z.enum(["easy", "medium", "challenge"]),
  ingredients: z.array(
    z.object({
      item: z.string(),
      amount: z.string().describe("e.g. '2 tbsp', '1 large', 'a handful'"),
      have: z.boolean().describe("true if this exact item is already in their pantry"),
      substitution: z
        .string()
        .nullable()
        .describe("A workable pantry substitute if they don't have this item, else null"),
    })
  ),
  can_improvise: z
    .boolean()
    .describe(
      "true if a genuinely workable version of this dish can be made using ONLY their pantry plus substitutions"
    ),
  improvise_note: z
    .string()
    .nullable()
    .describe(
      "If can_improvise is false, briefly explain what's missing and why no substitution saves it. Null if can_improvise is true."
    ),
});
export type DishCheck = z.infer<typeof DishCheckSchema>;

/* ─── Planned meals ("I want to make X" → drafts the shopping list) ─── */

export type PlannedMeal = {
  id: string;
  title: string;
  ingredients: DishCheck["ingredients"];
  created_at: string;
};

/* ─── Recipe (Claude) ─── */

export const RecipeStepSchema = z.object({
  n: z.number(),
  instruction: z.string().describe("The step itself, direct and clear"),
  detail: z
    .string()
    .describe(
      "Beginner detail: exactly how to do it, what it should look/smell/sound like"
    ),
  heat: z
    .enum(["off", "low", "medium-low", "medium", "medium-high", "high"])
    .nullable()
    .describe("Stovetop heat during this step, null if no stovetop heat involved"),
  oven_temp_c: z
    .number()
    .nullable()
    .describe(
      "Oven temperature in °C when the oven is used this step (e.g. 180) — note fan/no-fan in detail. Null if no oven involved"
    ),
  duration_min: z
    .number()
    .nullable()
    .describe("Rough minutes this step takes, null if instant"),
  timer_min: z
    .number()
    .nullable()
    .describe("Set a countdown timer for this many minutes, null if no timer needed"),
  watch_for: z
    .string()
    .nullable()
    .describe("The doneness cue: what tells you this step is done or going wrong"),
});

export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  servings: z.number(),
  time_minutes: z.number(),
  ingredients: z.array(
    z.object({
      item: z.string(),
      amount: z.string().describe("e.g. '2 tbsp', '1 large', 'a handful'"),
      prep: z.string().nullable().describe("e.g. 'finely chopped', null if none"),
    })
  ),
  equipment: z.array(z.string()),
  steps: z.array(RecipeStepSchema),
});
export type Recipe = z.infer<typeof RecipeSchema>;
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

/* ─── Explore dishes (Claude, cached in DB) ─── */

export const ExploreDishSchema = z.object({
  title: z.string(),
  description: z.string().describe("One appetizing sentence"),
  time_minutes: z.number(),
  difficulty: z.enum(["easy", "medium", "challenge"]),
  cuisine: z.string().describe("e.g. 'Italian', 'Namibian', 'Asian fusion'"),
  key_ingredients: z
    .array(z.string())
    .describe("The 4-8 essential ingredients, lowercase, singular"),
});
export const ExploreDishesSchema = z.object({
  dishes: z.array(ExploreDishSchema).describe("6 to 10 dishes"),
});
export type ExploreDish = z.infer<typeof ExploreDishSchema>;

/* ─── Cook session ─── */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CookSession = {
  id: string;
  recipe: Recipe;
  messages: ChatMessage[];
  current_step: number;
  status: "active" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
};

/* ─── Saved recipes ─── */

export type SavedRecipe = {
  id: string;
  recipe: Recipe;
  saved_at: string;
};

/* ─── Pantry / equipment rows ─── */

export type PantryItem = {
  id: string;
  name: string;
  quantity_text: string | null;
  source: "photo" | "manual";
  updated_at: string;
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity_text: string | null;
  reason: string | null;
  checked: boolean;
  created_at: string;
};

export const EQUIPMENT_OPTIONS = [
  "stove",
  "oven",
  "airfryer",
  "microwave",
  "kettle",
  "blender",
  "toaster",
  "grill/braai",
  "slow cooker",
  "rice cooker",
  "hand mixer",
  "kitchen scale",
  "baking tins & trays",
  "pots & pans",
] as const;
