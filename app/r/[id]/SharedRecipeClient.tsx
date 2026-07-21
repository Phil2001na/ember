"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RecipePreview from "@/components/RecipePreview";
import { createClient } from "@/lib/supabase/client";
import type { Recipe } from "@/lib/schemas";

export default function SharedRecipeClient({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const supabase = createClient();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCooking() {
    setStarting(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error: insertError } = await supabase
      .from("cook_sessions")
      .insert({ user_id: user!.id, recipe, status: "active" })
      .select("id")
      .single();
    setStarting(false);
    if (insertError || !data) {
      setError(insertError?.message ?? "Couldn't start this cook.");
      return;
    }
    router.push(`/cook/${data.id}`);
  }

  return (
    <main className="page fade-in" style={{ paddingTop: 30 }}>
      <p className="badge badge-accent" style={{ display: "inline-flex", marginBottom: 14 }}>
        Shared with you
      </p>
      {error && <p style={{ color: "var(--red-warn)", marginBottom: 12 }}>{error}</p>}
      <RecipePreview recipe={recipe} starting={starting} onStart={startCooking} />
    </main>
  );
}
