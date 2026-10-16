"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Drawer } from "@/components/ui/drawer";
import styles from "./nav.module.css";

export const NAV_LINKS = [
  { href: "/", label: "Arena" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/matches", label: "Matches" },
  { href: "/docs", label: "Docs" },
  { href: "/learn", label: "Learn" },
] as const;

export function isCurrent(path: string | null, href: string): boolean {
  if (!path) return false;
  if (href === "/") return path === "/";
  return path === href || path.startsWith(`${href}/`);
}

function Links({ path, onPick }: { path: string | null; onPick?: () => void }) {
  return NAV_LINKS.map(({ href, label }) => (
    <Link
      key={href}
      href={href}
      onClick={onPick}
      className={styles.link}
      aria-current={isCurrent(path, href) ? "page" : undefined}
    >
      {label}
    </Link>
  ));
}

// usePathname() suspends on routes whose params aren't known at build time, so
// the header wraps Nav in <Suspense> and shows these links meanwhile.
export function StaticNav({ account, upload }: { account: ReactNode; upload: ReactNode }) {
  return (
    <nav className={styles.nav} aria-label="Main">
      <div className={styles.links}>
        <Links path={null} />
      </div>
      <span className={styles.upload}>{upload}</span>
      <span className={styles.account}>{account}</span>
    </nav>
  );
}

export function Nav({ account, upload }: { account: ReactNode; upload: ReactNode }) {
  const path = usePathname();
  const linksRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(path);
  if (openedOn !== path) {
    setOpenedOn(path);
    setOpen(false);
  }

  useLayoutEffect(() => {
    const root = linksRef.current;
    if (!root) return;
    const place = () => {
      const active = root.querySelector<HTMLElement>('[aria-current="page"]');
      setBar(active ? { x: active.offsetLeft, w: active.offsetWidth } : null);
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(root);
    return () => ro.disconnect();
  }, [path]);

  return (
    <nav className={styles.nav} aria-label="Main">
      <div className={styles.links} ref={linksRef}>
        <Links path={path} />
        <span
          aria-hidden
          className={styles.bar}
          style={bar ? { transform: `translateX(${bar.x}px)`, width: bar.w, opacity: 1 } : { opacity: 0 }}
        />
      </div>
      <span className={styles.upload}>{upload}</span>
      <span className={styles.account}>{account}</span>
      <button type="button" className={styles.menu} aria-expanded={open} onClick={() => setOpen(true)}>
        Menu
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
        {/* Upload leads the menu. Closing on click covers /me#upload from /me itself,
            where the path doesn't change. */}
        <div className={styles.drawerUpload} onClick={() => setOpen(false)}>
          {upload}
        </div>
        <div className={styles.drawerLinks}>
          <Links path={path} onPick={() => setOpen(false)} />
          {account}
        </div>
      </Drawer>
    </nav>
  );
}

export function ScrollEdge() {
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (!header) return;
    const onScroll = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return null;
}
