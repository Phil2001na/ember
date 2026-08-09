import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** The cookie @supabase/ssr keeps the session in (it may be split into chunks). */
const AUTH_COOKIE = /^sb-.*-auth-token(\.\d+)?$/;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const hasSession = request.cookies.getAll().some((c) => AUTH_COOKIE.test(c.name));
  const isNavigation = request.headers.get("sec-fetch-dest") === "document";

  // Nothing to refresh and nothing to create: let sub-resource requests past
  // untouched rather than have each one race to mint its own kitchen.
  if (!hasSession && !isNavigation) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session (required for SSR).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Only ever mint on a true first visit. If a session cookie is present but
  // `getUser()` came back empty — an expired token, a refresh that lost a
  // race with a parallel request — minting a new anonymous user would
  // overwrite the cookie and silently orphan the kitchen, with no way back
  // (this is exactly how earlier kitchens got stranded). Leave the cookie
  // alone and let the client refresh it instead.
  if (!user && !hasSession) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) console.error("[proxy] signInAnonymously failed:", error.message);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.*|manifest.webmanifest|sw.js|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
