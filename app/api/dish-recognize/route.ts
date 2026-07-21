import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { eyes } from "@/lib/ai";
import { DishRecognizeSchema } from "@/lib/schemas";
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
    schema: DishRecognizeSchema,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `This is a photo of a finished dish — likely a screenshot from a cooking video
someone wants to recreate. Identify what dish this most likely is. Give your single best,
specific guess (e.g. "birria tacos" or "baked feta pasta", not just "tacos" or "pasta").
If the photo is ambiguous, ordinary-looking, or you genuinely can't tell, still give your
best guess but set confident to false.`,
          },
          { type: "image", image: bytes, mediaType: photo.type || "image/jpeg" },
        ],
      },
    ],
  });

  return NextResponse.json(object);
}
