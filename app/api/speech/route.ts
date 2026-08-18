import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const MODEL = "gpt-4o-mini-tts";
const DEFAULT_VOICE = "marin";
const MAX_INPUT_CHARS = 6_000;
const VOICES = new Set([
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
]);

function configuredVoice() {
  const voice = process.env.OPENAI_TTS_VOICE?.trim().toLowerCase();
  return voice && VOICES.has(voice) ? voice : DEFAULT_VOICE;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "Voice isn't set up yet (missing OpenAI key)" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const input =
    typeof body === "object" && body !== null && "text" in body
      ? String(body.text).replace(/\s+/g, " ").trim()
      : "";
  if (!input) return NextResponse.json({ error: "no text" }, { status: 400 });
  if (input.length > MAX_INPUT_CHARS) {
    return NextResponse.json({ error: "text too long" }, { status: 413 });
  }

  const upstream = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: configuredVoice(),
      input,
      instructions:
        "You are Ember, a warm, calm cooking coach. Speak naturally and clearly, with gentle energy and no theatrical delivery. Keep the pace brisk enough for someone actively cooking.",
      response_format: "mp3",
    }),
    signal: request.signal,
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "speech generation failed" }, { status: 502 });
  }

  // Forward the body rather than buffering it on the server. Sentence chunks
  // keep time-to-first-playback low and remain reliable on mobile browsers.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
