import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { brain } from "@/lib/ai";
import { PantryUpdateSchema, SuggestionsSchema } from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";
import { createClient } from "@/lib/supabase/server";

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
concrete, call the suggest_dishes tool. Default to EXACTLY 2 options: the best
dish for what they said, plus a noticeably quicker alternative for when they
can't be bothered (make the time difference real). Give just 1 if they named an
exact dish, and only more than 2 if they're clearly browsing with no direction.
Set "match" and "missing" against their ACTUAL pantry above — don't guess they
have something they haven't mentioned and isn't listed. Only skip the tool for
small talk or questions that aren't about picking a dish.

The pantry keeps itself through this chat. When they mention getting or buying
ingredients ("I bought eggs and mince"), or that something is finished, gone off,
or they don't actually have it, call update_pantry — adds and removals in one
call, no need to ask permission for obvious ones, just do it and carry on
naturally. For removals use the EXACT item names from their pantry above. If they
list ingredients they have on hand that aren't in the pantry yet, add those too.`,
    messages: await convertToModelMessages(messages),
    tools: {
      suggest_dishes: tool({
        description:
          "Show the cook dish options as swipeable cards, checked against their pantry. Default 2: the best fit + a quicker fallback.",
        inputSchema: SuggestionsSchema,
        execute: async ({ suggestions }) => ({ shown: suggestions.length }),
      }),
      update_pantry: tool({
        description:
          "Add or remove pantry items when the cook mentions buying something, having something unlisted, or finishing/losing an item.",
        inputSchema: PantryUpdateSchema,
        execute: async ({ add, remove }) => {
          const supabase = await createClient();
          const added: string[] = [];
          const removed: string[] = [];

          const toAdd = [...new Set(add.map((n) => n.trim().toLowerCase()))].filter(Boolean);
          if (toAdd.length) {
            const { data } = await supabase
              .from("pantry_items")
              .upsert(
                toAdd.map((name) => ({ user_id: kitchen.userId, name, source: "manual" as const })),
                { onConflict: "user_id,name" }
              )
              .select("name");
            added.push(...(data?.map((d) => d.name) ?? []));
          }

          const toRemove = [...new Set(remove.map((n) => n.trim().toLowerCase()))].filter(Boolean);
          if (toRemove.length) {
            const { data } = await supabase
              .from("pantry_items")
              .delete()
              .eq("user_id", kitchen.userId)
              .in("name", toRemove)
              .select("name");
            removed.push(...(data?.map((d) => d.name) ?? []));
          }

          return { added, removed };
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
