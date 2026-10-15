"use client";
import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import styles from "./course-map.module.css";

// Which lessons this browser has opened, kept in localStorage. No account, nothing sent anywhere.
const KEY = "learn:opened";
const EVENT = "learn-opened";

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return ""; // storage blocked: progress simply stays empty
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function useOpened(): Set<string> {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return useMemo(() => new Set(raw ? raw.split(",") : []), [raw]);
}

/** Put on a lesson page: records that the lesson was opened. Renders nothing. */
export function MarkOpened({ slug }: { slug: string }) {
  useEffect(() => {
    const opened = new Set(read().split(",").filter(Boolean));
    if (opened.has(slug)) return;
    opened.add(slug);
    try {
      localStorage.setItem(KEY, [...opened].join(","));
    } catch {
      return; // storage blocked: nothing to record
    }
    window.dispatchEvent(new Event(EVENT));
  }, [slug]);
  return null;
}

/** A small "Opened" mark on a chapter card, once this browser has read it. */
export function OpenedMark({ slug }: { slug: string }) {
  const opened = useOpened();
  if (!opened.has(slug)) return null;
  return <span className={styles.opened}>Opened</span>;
}

type Step = { slug: string; title: string; n: number; part: string };

/** One square per chapter, grouped by part, filled once opened. Offers the next unopened chapter. */
export function ProgressTrack({ parts }: { parts: { id: string; steps: Step[] }[] }) {
  const opened = useOpened();
  const all = parts.flatMap((p) => p.steps);
  const done = all.filter((s) => opened.has(s.slug)).length;
  const next = done > 0 ? all.find((s) => !opened.has(s.slug)) : undefined;
  return (
    <div className={styles.track}>
      <div className={styles.trackHead}>
        <span className={styles.trackLabel}>Your progress</span>
        <span className={styles.trackCount}>
          {done} of {all.length} opened
        </span>
      </div>
      <ol className={styles.trackParts} aria-label="Chapters by part">
        {parts.map((p) => (
          <li key={p.id} className={styles.trackPart}>
            <span className={styles.trackPartId}>{p.id}</span>
            <span className={styles.trackSquares}>
              {p.steps.map((s) => (
                <Link
                  key={s.slug}
                  href={`/learn/${s.slug}`}
                  className={styles.square}
                  data-opened={opened.has(s.slug) || undefined}
                  aria-label={`${s.n}. ${s.title}${opened.has(s.slug) ? ", opened" : ""}`}
                  title={`${s.n}. ${s.title}`}
                />
              ))}
            </span>
          </li>
        ))}
      </ol>
      {next ? (
        <Link href={`/learn/${next.slug}`} className={styles.trackNext}>
          Continue with {next.n}. {next.title} <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className={styles.trackHint}>{done === all.length && all.length > 0 ? "Every chapter opened." : "Open a chapter and it fills in here."}</span>
      )}
    </div>
  );
}
