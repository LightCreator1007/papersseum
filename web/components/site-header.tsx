import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "@/components/nav-links";
import { getProfileHandle } from "@/lib/queries";
import { getUserId } from "@/lib/supabase/server";

async function AccountLink() {
  const userId = await getUserId();
  if (!userId) return <Link href="/sign-in">Sign in</Link>;
  const handle = await getProfileHandle(userId);
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
          <NavLinks />
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
