import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { eyes, reasoningEffort } from "@/lib/ai";
import { VisionResultSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData();
  const photo = form.get("photo");
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "no photo" }, { status: 400 });
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());

  const { object } = await generateObject({
    model: eyes,
    providerOptions: reasoningEffort,
    schema: VisionResultSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This is a photo of someone's kitchen — a fridge, pantry shelf, counter, or groceries.
List every distinct food ingredient you can identify. Only actual ingredients (skip dishes,
appliances, containers whose contents you can't tell). Use simple lowercase names a recipe
would use ("tomato paste", "eggs", "cooking oil"). Estimate quantities loosely and honestly.`,
          },
          { type: "image", image: bytes, mediaType: photo.type || "image/jpeg" },
        ],
      },
    ],
  });

  return NextResponse.json(object);
}
