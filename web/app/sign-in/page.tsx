import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInButton } from "@/components/sign-in-button";
import { signInErrorMessage } from "@/lib/auth-errors";
import { getSeason } from "@/lib/queries";
import { safeNext } from "@/lib/redirect";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

async function SignInPanel({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  if (await getUserId()) redirect(next);
  const season = await getSeason();
  const message = signInErrorMessage(typeof params.error === "string" ? params.error : undefined, season.domain);
  return (
    <div className="stack">
      {message && (
        <p className="error-text" role="alert">
          {message}
        </p>
      )}
      <SignInButton next={next} />
      {season.domain && <p className="muted small">Use your @{season.domain} Google account.</p>}
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
