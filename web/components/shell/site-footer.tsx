import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/features/auth/actions";
import { LogoMark } from "@/components/brand/logo-mark";
import { LoadBoundary } from "@/components/load-boundary";
import { SubmitButton } from "@/components/submit-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getSeason } from "@/features/ladder/queries";
import { getUserId } from "@/lib/supabase/server";
import styles from "./site-footer.module.css";

const REPO = "https://github.com/dhairya-pandya/papersseum";

const COLUMNS = [
  {
    title: "Play",
    links: [
      { href: "/", label: "Arena" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/matches", label: "Matches" },
      { href: "/me", label: "Your bot" },
    ],
  },
  {
    title: "Build",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/learn", label: "Learn" },
      { href: `${REPO}/blob/main/COMPETITION.md`, label: "Rules" },
      { href: "https://pypi.org/project/papersseum/", label: "PyPI package" },
    ],
  },
  {
    title: "Platform",
    links: [
      { href: "/status", label: "Status" },
      { href: REPO, label: "GitHub" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
] as const;

async function SeasonLine() {
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
    <footer className={styles.footer}>
      <div className={`wrap ${styles.grid}`}>
        <div className={styles.brand}>
          <LogoMark size={28} animate="hover" />
          <p>A season-long bot tournament for IIITDM Jabalpur.</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title} className={styles.col}>
            <h2>{col.title}</h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith("http") ? (
                    <a href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                  ) : (
                    <Link href={l.href}>{l.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={`wrap ${styles.base}`}>
        <LoadBoundary what="the season" quiet>
          <Suspense fallback={null}>
            <SeasonLine />
          </Suspense>
        </LoadBoundary>
        <span className={styles.toggle}>
          <ThemeToggle />
        </span>
      </div>
    </footer>
  );
}
