import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes an expiring Supabase session before the page renders. Nothing else.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );
  await supabase.auth.getClaims();
  return response;
}

// Static files skip it, including the replay engine in public/engine/ (manifest, wheel, .mjs).
export const config = {
  matcher: ["/((?!_next/static|_next/image|engine/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|dat)$).*)"],
};
