import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { getProfileHandle } from "@/features/ladder/queries";
import { getUserId } from "@/lib/supabase/server";
import { Nav, ScrollEdge, StaticNav } from "./nav";
import { PausedBanner } from "./paused-banner";
import styles from "./site-header.module.css";

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

function Account() {
  return (
    <Suspense fallback={<Link href="/me">Your bot</Link>}>
      <AccountLink />
    </Suspense>
  );
}

export function SiteHeader() {
  return (
    <>
      <header className={styles.header} data-site-header>
        <div className={`wrap ${styles.row}`}>
          <Link href="/" className={styles.brand}>
            <LogoMark size={20} animate="hover" />
            <span>Papersseum</span>
          </Link>
          <Suspense fallback={<StaticNav account={<Account />} />}>
            <Nav account={<Account />} />
          </Suspense>
        </div>
        <ScrollEdge />
      </header>
      <PausedBanner />
    </>
  );
}
