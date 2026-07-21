import { notFound } from "next/navigation";
import { RecipeSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";
import SharedRecipeClient from "./SharedRecipeClient";

export default async function SharedRecipePage({ params }: PageProps<"/r/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_recipe", { p_share_id: id });
  if (error) notFound();
  const recipe = RecipeSchema.safeParse(data);
  if (!recipe.success) notFound();
  return <SharedRecipeClient recipe={recipe.data} />;
}
