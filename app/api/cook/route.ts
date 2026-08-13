import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { brain, reasoningEffort } from "@/lib/ai";
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
    voice = false,
  }: { sessionId: string; messages: UIMessage[]; currentStep: number; voice?: boolean } =
    await request.json();

  const { data: session } = await supabase
    .from("cook_sessions")
    .select("id, recipe")
    .eq("id", sessionId)
    .single();
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const recipe = session.recipe as Recipe;

  // Cache layout. We're on OpenAI (see lib/ai.ts), which caches automatically on
  // exact prefix match rather than on explicit breakpoints — so the only thing
  // that matters is keeping the front of the request byte-identical between
  // turns. The persona + kitchen + recipe block is stable for a whole cook; the
  // current-step line changes on every advance, so it goes AFTER the history
  // rather than in the system block, where it would have invalidated the recipe
  // (a big JSON blob) on every single step.
  //
  // The old explicit `anthropic.cacheControl` breakpoints that used to live here
  // were dead weight — the OpenAI provider drops them.
  const history = await convertToModelMessages(messages);

  // Voice guidance rides along with the step note rather than going into
  // `instructions`, so the cached prefix stays byte-identical whether or not
  // voice mode is on — toggling it mid-cook costs nothing.
  const stepNote: ModelMessage = {
    role: "system",
    content: [
      `They are currently on step ${currentStep + 1} of ${recipe.steps.length}.`,
      voice &&
        `They are in VOICE MODE: this reply will be READ ALOUD and they are not looking at the screen.
Keep it to 1-2 short sentences. No lists, no numbers-as-digits where a word reads better,
no markdown, no "as I mentioned". Say the one thing they need right now.
Always end by telling them what you're waiting for — "say go when it's in", "say next when
you're there" — so they know the turn is theirs.
When they tell you they've finished a step or want to move on, call next_step (or
previous_step / go_to_step) — their hands are busy and they cannot tap anything.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
  const conversation: ModelMessage[] =
    history.length > 0
      ? [...history.slice(0, -1), stepNote, history[history.length - 1]]
      : [stepNote];

  const result = streamText({
    model: brain,
    providerOptions: reasoningEffort,
    instructions: [
      {
        role: "system",
        content: `You are Ember, a calm, encouraging cooking coach talking to someone MID-COOK.
Their hands may be messy and the stove is on — answer fast, concrete, and short
(2-4 sentences unless they ask for more). No markdown formatting; plain spoken language.

${kitchenPrompt(kitchen)}

THE RECIPE THEY ARE COOKING RIGHT NOW:
${JSON.stringify(recipe)}

When something goes wrong (burnt it, too salty, missing an ingredient mid-cook) or they
want to change course: FIRST reassure and give the immediate action in words, THEN if the
remaining steps need to change, call the amend_recipe tool with the rewritten remaining
steps (keep the same step-numbering scheme, starting from the earliest step that changes —
current or later steps only). Small questions ("how do I know it's done?") need no tool call.

EVERY time you tell them to do something for a length of time ("simmer for 4 minutes",
"rest it for 10"), call the start_timer tool with that duration — their hands are busy, so
never make them set a timer themselves. Still say the duration out loud in your reply.
Skip the tool only for vague durations ("a few seconds", "until golden").`,
      },
    ],
    messages: conversation,
    // `stepNote` is a system message sitting inside `messages`, which the AI SDK
    // rejects by default (`allowSystemInMessages` defaults to false) — it throws
    // InvalidPromptError before the request ever leaves the process. The
    // mid-conversation placement is the whole point of the cache layout above,
    // so opt in rather than move it back into `instructions`.
    allowSystemInMessages: true,
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
      start_timer: tool({
        description:
          "Start a countdown timer on the user's screen. Call whenever you tell them to do something for a specific duration; replaces any timer already running on the current step.",
        inputSchema: z.object({
          minutes: z
            .number()
            .describe("Duration in minutes; decimals allowed, e.g. 4 or 0.5"),
          label: z
            .string()
            .describe("Short label for what's being timed, e.g. 'simmer the sauce'"),
        }),
        // The countdown itself runs client-side (CookClient watches for this
        // tool part); this just acknowledges so the model can keep talking.
        execute: async () => ({ started: true }),
      }),
      // Navigation. In voice mode these are the only way the cook can move
      // through the recipe at all, so they matter more than they look —
      // the client applies them the same way it applies start_timer.
      next_step: tool({
        description:
          "Move the cook forward to the next step. Call this whenever they say they've finished the current step or want to move on.",
        inputSchema: z.object({}),
        execute: async () => ({ moved: "next" }),
      }),
      previous_step: tool({
        description:
          "Move the cook back to the previous step, e.g. when they missed something or want to hear it again.",
        inputSchema: z.object({}),
        execute: async () => ({ moved: "previous" }),
      }),
      go_to_step: tool({
        description:
          "Jump to a specific step number when they name one ('take me back to step 3').",
        inputSchema: z.object({
          step_number: z
            .number()
            .int()
            .describe(`The step to jump to, 1-based (1 to ${recipe.steps.length})`),
        }),
        execute: async () => ({ moved: "jump" }),
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
