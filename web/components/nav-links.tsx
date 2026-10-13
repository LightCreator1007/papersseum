"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/matches", label: "Matches" },
  { href: "/getting-started", label: "Getting started" },
];

function Links({ path }: { path: string | null }) {
  return LINKS.map(({ href, label }) => (
    <Link key={href} href={href} aria-current={path?.startsWith(href) ? "page" : undefined}>
      {label}
    </Link>
  ));
}

// usePathname() suspends on routes whose params aren't known at build time, so
// the header wraps NavLinks in <Suspense> and shows these same links meanwhile.
export function StaticNavLinks() {
  return <Links path={null} />;
}

export function NavLinks() {
  const path = usePathname();
  return <Links path={path} />;
}
