import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inferMealOutcome } from "@/lib/fitnessHandoff";
import type { Recipe } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * Ember → Fitness, standing link (see docs/integrations/fitness-v3.md).
 *
 * Unlike the V1/V2 browser handoff, this covers cooks that never came from a
 * Fitness nudge: the browser calls Ember (this route, session-authenticated),
 * and Ember calls Fitness server-to-server with a shared secret — the request
 * never carries the secret to the browser, and there's no request_id to forge
 * because Fitness never issued one.
 */
export async function POST(request: Request) {
  const fitnessBase = process.env.NEXT_PUBLIC_FITNESS_URL;
  const secret = process.env.EMBER_FITNESS_LOG_SECRET;
  if (!fitnessBase || !secret) {
    return NextResponse.json({ error: "not-configured" }, { status: 501 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("fitness_auto_log")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.fitness_auto_log) {
    return NextResponse.json({ error: "not-connected" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "missing-session" }, { status: 400 });
  }

  // RLS scopes this to the caller's own session — a stray id just 404s.
  const { data: session } = await supabase
    .from("cook_sessions")
    .select("recipe, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.status !== "completed") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const outcome = inferMealOutcome(session.recipe as Recipe, randomUUID());

  let res: Response;
  try {
    res = await fetch(new URL("/api/nutrition/log", fitnessBase), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-integration-secret": secret },
      body: JSON.stringify({
        v: 2,
        ember_user_id: user.id,
        request_id: outcome.requestId,
        eaten: outcome.eaten,
        size: outcome.size,
        protein_anchor: outcome.proteinAnchor,
        confidence: outcome.confidence,
        kcal: outcome.kcal,
        protein_g: outcome.proteinG,
        title: outcome.title,
      }),
    });
  } catch {
    return NextResponse.json({ error: "fitness-unreachable" }, { status: 502 });
  }
  if (!res.ok) return NextResponse.json({ error: "fitness-rejected" }, { status: 502 });

  return NextResponse.json({ ok: true });
}
