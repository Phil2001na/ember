import type { Recipe, RecipeStep } from "@/lib/schemas";

/** Replace the remaining steps of a recipe with amended ones (mid-cook pivot). */
export function applyAmendment(recipe: Recipe, remaining: RecipeStep[]): Recipe {
  if (!remaining.length) return recipe;
  const firstN = Math.min(...remaining.map((s) => s.n));
  return {
    ...recipe,
    steps: [...recipe.steps.filter((s) => s.n < firstN), ...remaining],
  };
}
