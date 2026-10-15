"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./me.module.css";

const TABS = [
  { href: "/me", label: "Overview" },
  { href: "/me/forge", label: "Bot Forge" },
  { href: "/me/versions", label: "Versions" },
  { href: "/me/inbox", label: "Inbox" },
  { href: "/me/settings", label: "Settings" },
] as const;

function Tabs({ path }: { path: string | null }) {
  return (
    <nav className={styles.tabs} aria-label="Your bot">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

export function StaticMeNav() {
  return <Tabs path={null} />;
}

export function MeNav() {
  return <Tabs path={usePathname()} />;
}
