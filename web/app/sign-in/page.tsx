import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInButton } from "@/features/auth/components/sign-in-button";
import { signInErrorMessage } from "@/features/auth/auth-errors";
import { getSeason } from "@/features/ladder/queries";
import { safeNext } from "@/features/auth/redirect";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

async function SignInPanel({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  if (await getUserId()) redirect(next);
  let domain: string | null = null;
  try {
    domain = (await getSeason()).domain;
  } catch {
    // getSeason already logged it. Sign-in works without the domain hint.
  }
  const message = signInErrorMessage(typeof params.error === "string" ? params.error : undefined, domain);
  return (
    <div className="stack">
      {message && (
        <p className="error-text" role="alert">
          {message}
        </p>
      )}
      <SignInButton next={next} />
      {domain && <p className="muted small">Use your @{domain} Google account.</p>}
    </div>
  );
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <Suspense fallback={null}>
        <SignInPanel searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
