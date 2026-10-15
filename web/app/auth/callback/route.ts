import { NextResponse, type NextRequest } from "next/server";
import { signInErrorKind } from "@/features/auth/auth-errors";
import { safeNext } from "@/features/auth/redirect";
import { createClient } from "@/lib/supabase/server";

// `next dev` reports request.url as localhost whatever the browser used, so a
// visit on 127.0.0.1 would be sent to localhost, where its session cookie
// (host-only) doesn't exist. The Host header is what the browser really used.
function siteOrigin(request: NextRequest): string {
  const { origin, protocol } = new URL(request.url);
  const host = request.headers.get("host");
  return process.env.NODE_ENV === "development" && host ? `${protocol}//${host}` : origin;
}

const FIRST_SIGN_IN_MS = 10 * 60_000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = siteOrigin(request);
  const kind = signInErrorKind(searchParams);
  if (kind) {
    if (kind !== "cancelled") console.error("auth callback:", Object.fromEntries(searchParams));
    return NextResponse.redirect(`${origin}/sign-in?error=${kind}`);
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(searchParams.get("code")!);
  if (error) {
    console.error("auth callback: code exchange failed", error);
    return NextResponse.redirect(`${origin}/sign-in?error=expired`);
  }
  const next = safeNext(searchParams.get("next"));
  // An account created moments ago is a first sign-in: show Welcome before anything else.
  const created = data.user?.created_at ? Date.parse(data.user.created_at) : NaN;
  if (Date.now() - created < FIRST_SIGN_IN_MS) {
    return NextResponse.redirect(`${origin}/welcome?next=${encodeURIComponent(next)}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
