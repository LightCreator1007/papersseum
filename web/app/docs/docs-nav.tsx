"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./docs.module.css";

type Groups = { group: string; pages: { slug: string; title: string }[] }[];

function List({ groups, path }: { groups: Groups; path: string | null }) {
  return (
    <nav aria-label="Docs" className={styles.nav}>
      <Link href="/docs" className={styles.home} aria-current={path === "/docs" ? "page" : undefined}>
        Docs home
      </Link>
      {groups.map((g) => (
        <div key={g.group}>
          <p className={styles.group}>{g.group}</p>
          <ul>
            {g.pages.map((p) => {
              const href = `/docs/${p.slug}`;
              return (
                <li key={p.slug}>
                  <Link href={href} aria-current={path === href ? "page" : undefined}>
                    {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className={styles.group}>Course</p>
      <ul>
        <li>
          <Link href="/learn">Learn RL from zero</Link>
        </li>
      </ul>
    </nav>
  );
}

function Live({ groups }: { groups: Groups }) {
  return <List groups={groups} path={usePathname()} />;
}

export function DocsNav({ groups, static: isStatic = false }: { groups: Groups; static?: boolean }) {
  return isStatic ? <List groups={groups} path={null} /> : <Live groups={groups} />;
}
