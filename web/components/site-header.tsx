import Link from "next/link";
import { Suspense } from "react";
import { NavLinks, StaticNavLinks } from "@/components/nav-links";
import { getProfileHandle } from "@/lib/queries";
import { getUserId } from "@/lib/supabase/server";

async function AccountLink() {
  const userId = await getUserId();
  if (!userId) return <Link href="/sign-in">Sign in</Link>;
  let handle: string | null = null;
  try {
    handle = await getProfileHandle(userId);
  } catch {
    // getProfileHandle already logged it. A failed profile read must not take
    // down every page, so fall back to the generic label.
  }
  return <Link href="/me">{handle ?? "Your bot"}</Link>;
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">
          Papersseum
        </Link>
        <nav className="nav">
          <Suspense fallback={<StaticNavLinks />}>
            <NavLinks />
          </Suspense>
          <span className="account">
            <Suspense fallback={null}>
              <AccountLink />
            </Suspense>
          </span>
        </nav>
      </div>
    </header>
  );
}
