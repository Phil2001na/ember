import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CookClient from "./CookClient";
import type { Recipe } from "@/lib/schemas";
import type { UIMessage } from "ai";

export default async function CookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("cook_sessions")
    .select("id, recipe, messages, current_step, status")
    .eq("id", id)
    .maybeSingle();

  if (!session) notFound();

  return (
    <CookClient
      sessionId={session.id}
      initialRecipe={session.recipe as Recipe}
      initialMessages={(session.messages ?? []) as UIMessage[]}
      initialStep={session.current_step}
      initialStatus={session.status}
    />
  );
}
