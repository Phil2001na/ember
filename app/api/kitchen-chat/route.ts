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
import {
  PantryUpdateSchema,
  ShoppingListUpdateSchema,
  SuggestionsSchema,
} from "@/lib/schemas";
import { loadKitchen, kitchenPrompt } from "@/lib/kitchen";
import { createClient } from "@/lib/supabase/server";
import { stripImageData, withoutImages } from "@/lib/kitchenMemory";

export const maxDuration = 60;

export async function POST(request: Request) {
  const kitchen = await loadKitchen();
  if (!kitchen) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { messages }: { messages: UIMessage[] } = await request.json();
  const incoming = messages.at(-1);
  if (!incoming || incoming.role !== "user") {
    return NextResponse.json({ error: "a user message is required" }, { status: 400 });
  }

  // The database, rather than a tab's React state, is the source of truth.
  // That makes a refresh or second device a continuation, not a fork.
  const { data: stored } = await supabase
    .from("kitchen_messages")
    .select("id, role, parts")
    .eq("user_id", kitchen.userId)
    .order("created_at", { ascending: false })
    .limit(40);
  const { error: saveIncomingError } = await supabase.from("kitchen_messages").insert({
    user_id: kitchen.userId,
    role: "user",
    parts: stripImageData(incoming.parts),
  });
  if (saveIncomingError) return NextResponse.json({ error: "couldn't save your message" }, { status: 500 });

  // Cache layout. We're on OpenAI (see lib/ai.ts): caching is automatic on exact
  // prefix match, so the win comes from keeping the front of the request stable.
  // The pantry and shopping list are rewritten every time the tools below fire,
  // so they ride after the history instead of inside the system block — where
  // they used to invalidate the ~700 tokens of rules underneath them on every
  // pantry change. The old explicit `anthropic.cacheControl` breakpoints are
  // gone; the OpenAI provider drops them.
  // The query pulls newest-first (that's how you take the LAST 40), so it has to
  // be flipped back into chronological order before the model sees it. Sending
  // it reversed didn't just scramble the transcript — it put the newest message
  // at the FRONT of the history, so the request prefix changed on every turn and
  // nothing could ever be served from cache.
  const priorTurns = [...(stored ?? [])]
    .reverse()
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: withoutImages(message.parts as UIMessage["parts"]),
    }))
    .filter((message) => message.parts.length > 0) as UIMessage[];
  const history = await convertToModelMessages([...priorTurns, incoming]);

  const pantryContext: ModelMessage = {
    role: "system",
    content: `THE KITCHEN RIGHT NOW (trust this over anything said earlier)

${kitchenPrompt(kitchen)}`,
  };
  const conversation: ModelMessage[] =
    history.length > 0
      ? [...history.slice(0, -1), pantryContext, history[history.length - 1]]
      : [pantryContext];

  const result = streamText({
    model: brain,
    providerOptions: reasoningEffort,
    instructions: [
      {
        role: "system",
        content: `You are Ember, a warm and practical cooking companion having a casual chat
with someone deciding what to cook. Keep replies short — 1-3 spoken sentences, no
markdown. The dish cards carry the details, so don't restate ingredients or steps
in prose.

Their pantry and shopping list are in THE KITCHEN RIGHT NOW block near the end of
the conversation below — "above"/"listed" in the rules here means that block.

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

Treat CONFIRMED COOKING PREFERENCES as durable instructions from the cook. Recently
cooked dishes are only a gentle anti-repeat signal: don't offer the same meal again
unless they ask for it, and don't infer a new preference from one meal.

They also keep a shopping list (shown above). When they say they NEED something
they don't have ("I need to buy parmesan", "put milk on the list"), or a dish
they've settled on needs ingredients they lack, call update_shopping_list to add
those — include a short reason like "for lasagna" when it comes from a dish.
Never add something that's already in their pantry. When they say they BOUGHT
something, that goes to update_pantry as an add AND update_shopping_list as a
remove if it was on the list.`,
      },
    ],
    messages: conversation,
    // `pantryContext` is a system message sitting inside `messages`, which the AI
    // SDK rejects by default (`allowSystemInMessages` defaults to false) — it
    // throws InvalidPromptError before the request ever leaves the process. The
    // mid-conversation placement is the whole point of the cache layout above,
    // so opt in rather than move it back into `instructions`.
    allowSystemInMessages: true,
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
      remember_preference: tool({
        description:
          "Remember a durable cooking preference only when the cook clearly asks you to remember it or states it as a standing preference. Examples: a dislike, allergy/context not already in dietary notes, a household preference, a weekday time limit, or a food-budget preference. Do not infer preferences from one meal or use this for pantry items.",
        inputSchema: z.object({
          text: z.string().min(2).max(280).describe("One concise, durable preference in your own words"),
        }),
        execute: async ({ text }) => {
          const preference = text.trim();
          const { data, error } = await supabase
            .from("kitchen_preferences")
            .upsert({ user_id: kitchen.userId, text: preference }, { onConflict: "user_id,text" })
            .select("text")
            .single();
          return error ? { error: "Couldn't save that preference." } : { remembered: data.text };
        },
      }),
      forget_preference: tool({
        description:
          "Forget one confirmed cooking preference when the cook clearly asks to remove or change it. Pass its exact wording from CONFIRMED COOKING PREFERENCES; if it is unclear, ask them which preference they mean.",
        inputSchema: z.object({
          text: z.string().min(2).max(280).describe("The exact preference wording to remove"),
        }),
        execute: async ({ text }) => {
          const { data, error } = await supabase
            .from("kitchen_preferences")
            .delete()
            .eq("user_id", kitchen.userId)
            .eq("text", text.trim())
            .select("text");
          if (error) return { error: "Couldn't remove that preference." };
          return data?.length ? { forgotten: data[0].text } : { error: "That preference wasn't found." };
        },
      }),
    },
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse({
    originalMessages: [incoming],
    onEnd: async ({ responseMessage, isAborted }) => {
      if (isAborted || responseMessage.parts.length === 0) return;
      // A failed memory write must never make an already-complete answer fail.
      try {
        await supabase.from("kitchen_messages").insert({
          user_id: kitchen.userId,
          role: "assistant",
          parts: stripImageData(responseMessage.parts),
        });
      } catch {}
    },
  });
}
