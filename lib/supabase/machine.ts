import { createClient as createPlainClient } from "@supabase/supabase-js";

/**
 * Session-less client for the Fitness integration, which runs with no user
 * present. It holds only anon rights — elevated reads happen inside the
 * secret-gated `public.ember_pantry_for_integration` RPC.
 */
export function createMachineClient() {
  return createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
