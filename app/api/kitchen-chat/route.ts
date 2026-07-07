import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { SuggestionsSchema } from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";

export const maxDuration = 60;

export async function POST(request: Request) {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { messages }: { messages: UIMessage[] } = await request.json();

  const result = streamText({
    model: brain,
    system: `You are Ember, a warm and practical cooking companion having a casual chat
with someone deciding what to cook. Keep replies short — 1-3 spoken sentences, no
markdown. The dish cards carry the details, so don't restate ingredients or steps
in prose.

${kitchenPrompt(kitchen)}

They might name a specific dish, describe a craving, list random ingredients they
want to use up, or just chat. Whenever you have enough to propose something
concrete, call the suggest_dishes tool with 1-5 real options (1 if they named an
exact dish, several if they're browsing). Set "match" and "missing" against their
ACTUAL pantry above — don't guess they have something they haven't mentioned and
isn't listed. Only skip the tool for small talk or questions that aren't about
picking a dish.`,
    messages: await convertToModelMessages(messages),
    tools: {
      suggest_dishes: tool({
        description:
          "Show the cook 1-5 dish options as swipeable cards, checked against their pantry.",
        inputSchema: SuggestionsSchema,
        execute: async ({ suggestions }) => ({ shown: suggestions.length }),
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
