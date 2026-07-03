import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "Voice isn't set up yet (missing Groq key)" },
      { status: 503 }
    );
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "no audio" }, { status: 400 });
  }

  const groqForm = new FormData();
  groqForm.append("file", audio, "voice.webm");
  groqForm.append("model", "whisper-large-v3");
  groqForm.append("response_format", "json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  });

  if (!res.ok) {
    return NextResponse.json({ error: "transcription failed" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ text: (data.text ?? "").trim() });
}
