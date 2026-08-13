import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/* Speech-in runs on OpenAI, same key as the rest of the app. (This used to be
   Groq whisper-large-v3; that key started returning 401 Invalid API Key, which
   silently made voice mode deaf — every utterance 502'd.) */
const MODEL = "gpt-4o-mini-transcribe";

/* Biasing prompt sentinel. These models will happily regurgitate the prompt as
   the transcript when the audio is silence or pure noise — a real hazard when
   the mic opens itself in a kitchen. Every hint we send starts with this
   phrase, so an echo is trivially detectable and can be dropped. */
const HINT_SENTINEL = "Ember kitchen voice control.";

/** Whisper-family prompts cap out around 224 tokens; keep well under. */
const MAX_PROMPT_CHARS = 600;

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
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

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "no audio" }, { status: 400 });
  }

  const hint = form.get("prompt");
  const prompt =
    typeof hint === "string" && hint.trim()
      ? `${HINT_SENTINEL} ${hint.trim()}`.slice(0, MAX_PROMPT_CHARS)
      : null;

  const upstream = new FormData();
  upstream.append("file", audio, "voice.webm");
  upstream.append("model", MODEL);
  upstream.append("response_format", "json");
  // pinned rather than auto-detected: a one-word utterance ("go") over pan
  // noise is exactly where language detection flips and garbles the word
  upstream.append("language", "en");
  if (prompt) upstream.append("prompt", prompt);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: upstream,
  });

  if (!res.ok) {
    return NextResponse.json({ error: "transcription failed" }, { status: 502 });
  }

  const data = await res.json();
  const text = (data.text ?? "").trim();

  // drop prompt echo — silence/noise, not speech
  if (
    prompt &&
    (normalize(text).includes(normalize(HINT_SENTINEL)) ||
      normalize(text) === normalize(prompt))
  ) {
    return NextResponse.json({ text: "" });
  }

  return NextResponse.json({ text });
}
