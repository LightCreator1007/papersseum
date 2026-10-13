"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/matches", label: "Matches" },
  { href: "/getting-started", label: "Getting started" },
];

export function NavLinks() {
  const path = usePathname();
  return LINKS.map(({ href, label }) => (
    <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}>
      {label}
    </Link>
  ));
}
