import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "@/components/brand/logo-mark";
import { getProfileName } from "@/features/ladder/queries";
import { firstName } from "@/lib/owner-name";
import { getUserId } from "@/lib/supabase/server";
import { Nav, ScrollEdge, StaticNav } from "./nav";
import { PausedBanner } from "./paused-banner";
import styles from "./site-header.module.css";

async function AccountLink() {
  const userId = await getUserId();
  if (!userId) return <Link href="/sign-in">Sign in</Link>;
  let name: string | null = null;
  try {
    name = await getProfileName(userId);
  } catch {
    // getProfileName already logged it. A failed profile read must not take
    // down every page, so fall back to the generic label.
  }
  return <Link href="/me">{firstName(name) ?? "Your bot"}</Link>;
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
