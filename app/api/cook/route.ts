import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { RecipeStepSchema, type Recipe } from "@/lib/schemas";
import { applyAmendment } from "@/lib/recipe";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 90;

export async function POST(request: Request) {
  const supabase = await createClient();
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const {
    sessionId,
    messages,
    currentStep,
  }: { sessionId: string; messages: UIMessage[]; currentStep: number } =
    await request.json();

  const { data: session } = await supabase
    .from("cook_sessions")
    .select("id, recipe")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const recipe = session.recipe as Recipe;

  const result = streamText({
    model: brain,
    system: `You are Ember, a calm, encouraging cooking coach talking to someone MID-COOK.
Their hands may be messy and the stove is on — answer fast, concrete, and short
(2-4 sentences unless they ask for more). No markdown formatting; plain spoken language.

${kitchenPrompt(kitchen)}

THE RECIPE THEY ARE COOKING RIGHT NOW:
${JSON.stringify(recipe)}

They are currently on step ${currentStep + 1} of ${recipe.steps.length}.

When something goes wrong (burnt it, too salty, missing an ingredient mid-cook) or they
want to change course: FIRST reassure and give the immediate action in words, THEN if the
remaining steps need to change, call the amend_recipe tool with the rewritten remaining
steps (keep the same step-numbering scheme, starting from the earliest step that changes —
current or later steps only). Small questions ("how do I know it's done?") need no tool call.`,
    messages: await convertToModelMessages(messages),
    tools: {
      amend_recipe: tool({
        description:
          "Rewrite the remaining steps of the current recipe when the plan needs to change (over-salted, ingredient missing, timing shifted). Pass ALL steps from the earliest changed step to the end.",
        inputSchema: z.object({
          remaining_steps: z
            .array(RecipeStepSchema)
            .describe("The full new set of steps from the first changed step onward"),
        }),
        execute: async ({ remaining_steps }) => {
          const amended = applyAmendment(recipe, remaining_steps);
          await supabase
            .from("cook_sessions")
            .update({ recipe: amended })
            .eq("id", sessionId);
          return { applied: true, total_steps: amended.steps.length };
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
