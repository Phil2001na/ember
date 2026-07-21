export async function shareSavedRecipe(savedRecipeId: string, title: string) {
  const res = await fetch("/api/recipe-share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ savedRecipeId }),
  });
  if (!res.ok) throw new Error("Ember couldn't prepare that link.");
  const { id } = (await res.json()) as { id: string };
  const url = new URL(`/r/${id}`, window.location.origin).toString();

  if (navigator.share) {
    await navigator.share({ title, text: `${title} — cook it step by step with Ember.`, url });
    return "shared" as const;
  }

  await navigator.clipboard.writeText(url);
  return "copied" as const;
}
