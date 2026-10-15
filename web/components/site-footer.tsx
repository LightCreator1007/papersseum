import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/features/auth/actions";
import { LoadBoundary } from "@/components/load-boundary";
import { SubmitButton } from "@/components/submit-button";
import { getSeason } from "@/features/ladder/queries";
import { getUserId } from "@/lib/supabase/server";

async function FooterContent() {
  const [season, userId] = await Promise.all([getSeason(), getUserId()]);
  return (
    <>
      <span>{season.name}</span>
      {season.engineHash && <span className="mono">engine {season.engineHash}</span>}
      {userId && (
        <form action={signOut}>
          <SubmitButton className="link-button" pendingText="Signing out…">
            Sign out
          </SubmitButton>
        </form>
      )}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <LoadBoundary what="the season" quiet>
          <Suspense fallback={null}>
            <FooterContent />
          </Suspense>
        </LoadBoundary>
        <Link href="/privacy">Privacy</Link>
      </div>
    </footer>
  );
}
