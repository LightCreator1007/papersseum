import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInButton } from "@/features/auth/components/sign-in-button";
import { StatePage } from "@/components/state-page";
import { Skeleton } from "@/components/ui/skeleton";
import { signInErrorMessage } from "@/features/auth/auth-errors";
import { getSeason } from "@/features/ladder/queries";
import { safeNext } from "@/features/auth/redirect";
import { getUserId } from "@/lib/supabase/server";
import { DEV_PERSONAS, devAuthEnabled } from "@/lib/dev-auth";

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
      {devAuthEnabled() && (
        <nav className="dev-login" aria-label="Dev login">
          <p className="muted small">Dev only: sign in as a fixture persona. Nothing is saved.</p>
          <ul>
            {Object.entries(DEV_PERSONAS).map(([key, p]) => (
              <li key={key}>
                {/* A plain link: the route sets a cookie, so it must not be prefetched. */}
                <a href={`/dev/login?as=${key}&next=${encodeURIComponent(next)}`}>{p.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <StatePage seed="welcome" title="Sign in to enter the arena.">
      <p>One Google account, one bot. Upload a Python agent and it starts playing in the next round.</p>
      <Suspense fallback={<Skeleton rows={2} label="Loading sign-in" />}>
        <SignInPanel searchParams={props.searchParams} />
      </Suspense>
    </StatePage>
  );
}
