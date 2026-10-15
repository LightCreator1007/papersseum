import { NextResponse, type NextRequest } from "next/server";
import { DEV_AUTH_COOKIE, devAuthEnabled, isDevPersona } from "@/lib/dev-auth";
import { safeNext } from "@/features/auth/redirect";

// Dev-only fake login. /dev/login?as=player&next=/me sets the persona cookie;
// ?as=off clears it. 404 outside `next dev`.
export function GET(request: NextRequest) {
  if (!devAuthEnabled()) return new NextResponse(null, { status: 404 });
  const as = request.nextUrl.searchParams.get("as");
  const next = safeNext(request.nextUrl.searchParams.get("next"), as === "off" ? "/" : as === "organiser" ? "/admin" : "/me");
  // The newcomer persona stands in for a first sign-in, so it lands on Welcome like one.
  const target = as === "newcomer" ? `/welcome?next=${encodeURIComponent(next)}` : next;
  const response = NextResponse.redirect(new URL(target, request.url));
  if (isDevPersona(as)) response.cookies.set(DEV_AUTH_COOKIE, as, { path: "/", httpOnly: true, sameSite: "lax" });
  else response.cookies.delete(DEV_AUTH_COOKIE);
  return response;
}
