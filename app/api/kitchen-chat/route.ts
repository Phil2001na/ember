import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import { brain, reasoningEffort } from "@/lib/ai";
import {
  PantryUpdateSchema,
  ShoppingListUpdateSchema,
  SuggestionsSchema,
} from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { messages }: { messages: UIMessage[] } = await request.json();

  // Anthropic prompt caching: breakpoint on the system block, plus one on the last
  // history message so each turn reads prior turns from cache. The kitchen prompt
  // changes when the pantry tools fire, which just rewrites the cache — fine.
  // Gemini ignores the providerOptions.
  const cacheBreakpoint = {
    anthropic: { cacheControl: { type: "ephemeral" as const } },
  };

  const history = await convertToModelMessages(messages);
  if (history.length > 0) {
    history[history.length - 1].providerOptions = cacheBreakpoint;
  }

  const result = streamText({
    model: brain,
    providerOptions: reasoningEffort,
    instructions: [
      {
        role: "system",
        providerOptions: cacheBreakpoint,
        content: `You are Ember, a warm and practical cooking companion having a casual chat
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
list ingredients they have on hand that aren't in the pantry yet, add those too.

They also keep a shopping list (shown above). When they say they NEED something
they don't have ("I need to buy parmesan", "put milk on the list"), or a dish
they've settled on needs ingredients they lack, call update_shopping_list to add
those — include a short reason like "for lasagna" when it comes from a dish.
Never add something that's already in their pantry. When they say they BOUGHT
something, that goes to update_pantry as an add AND update_shopping_list as a
remove if it was on the list.`,
      },
    ],
    messages: history,
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
      update_shopping_list: tool({
        description:
          "Add or remove items on the cook's shopping list — when they need to buy something, a chosen dish needs things they lack, or a listed item was bought / is no longer needed.",
        inputSchema: ShoppingListUpdateSchema,
        execute: async ({ add, remove }) => {
          const supabase = await createClient();
          const pantryNames = new Set(kitchen.pantry.map((p) => p.name.toLowerCase()));
          const added: string[] = [];
          const removed: string[] = [];
          const alreadyHave: string[] = [];

          const seen = new Set<string>();
          const toAdd: typeof add = [];
          for (const a of add) {
            const name = a.name.trim().toLowerCase();
            if (!name || seen.has(name)) continue;
            seen.add(name);
            if (pantryNames.has(name)) alreadyHave.push(name);
            else toAdd.push({ ...a, name });
          }
          if (toAdd.length) {
            const { data } = await supabase
              .from("shopping_items")
              .upsert(
                toAdd.map((a) => ({
                  user_id: kitchen.userId,
                  name: a.name,
                  quantity_text: a.quantity,
                  reason: a.reason,
                })),
                { onConflict: "user_id,name" }
              )
              .select("name");
            added.push(...(data?.map((d) => d.name) ?? []));
          }

          const toRemove = [...new Set(remove.map((n) => n.trim().toLowerCase()))].filter(Boolean);
          if (toRemove.length) {
            const { data } = await supabase
              .from("shopping_items")
              .delete()
              .eq("user_id", kitchen.userId)
              .in("name", toRemove)
              .select("name");
            removed.push(...(data?.map((d) => d.name) ?? []));
          }

          return { added, removed, already_have: alreadyHave };
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
