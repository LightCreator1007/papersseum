import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import styles from "@/features/learn/components/course-map.module.css";
import { LessonArt } from "@/features/learn/components/lesson-art";
import { OpenedMark, ProgressTrack } from "@/features/learn/components/progress";
import { course, type Chapter } from "@/features/learn/manifest";

export const metadata: Metadata = {
  title: "Learn",
  description: "A free, beginner-friendly course on reinforcement learning. JEE Mains maths is all you need.",
};

// Parts get harder as the course goes on; each part also gets a slot colour for its drawings.
const LEVEL = ["Beginner", "Intermediate", "Intermediate", "Advanced", "Advanced"];
const partStyle = (i: number): CSSProperties & { "--part": string } => ({ "--part": `var(--slot-${i % 5})` });
const chapterNo = (slug: string) => Number(slug.split("-")[0]);

function Card({ slug, ready, art, children }: { slug: string; ready: boolean; art: ReactNode; children: ReactNode }) {
  const inner = (
    <>
      <span className={styles.cardArt}>{art}</span>
      <span className={styles.cardBody}>{children}</span>
    </>
  );
  return (
    <li className={styles.card} data-soon={ready ? undefined : ""}>
      {ready ? (
        <Link href={`/learn/${slug}`} className={styles.cardLink}>
          {inner}
        </Link>
      ) : (
        <div className={styles.cardLink}>{inner}</div>
      )}
    </li>
  );
}

function ChapterCard({ chapter, level }: { chapter: Chapter; level: string }) {
  const ready = chapter.status === "ready";
  return (
    <Card slug={chapter.slug} ready={ready} art={<LessonArt slug={chapter.slug} />}>
      <span className={styles.cardTop}>
        <span className={styles.num}>{String(chapterNo(chapter.slug)).padStart(2, "0")}</span>
        {ready ? <OpenedMark slug={chapter.slug} /> : null}
        <span className={styles.chip}>{ready ? `${chapter.minutes} min` : "Soon"}</span>
        <span className={styles.chip}>{level}</span>
      </span>
      <span className={styles.cardTitle}>{chapter.title}</span>
      <span className={styles.cardSum}>{chapter.summary}</span>
    </Card>
  );
}

export default function LearnHome() {
  const chapters = course.parts.flatMap((p) => p.chapters);
  const ready = chapters.filter((c) => c.status === "ready");
  const hours = Math.round(chapters.reduce((a, c) => a + c.minutes, 0) / 60);
  const first = ready[0];
  const track = course.parts.map((p) => ({
    id: p.id,
    steps: p.chapters.filter((c) => c.status === "ready").map((c) => ({ slug: c.slug, title: c.title, n: chapterNo(c.slug), part: p.id })),
  }));

  return (
    <div className={styles.home}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Free course · no sign-in</p>
          <h1 className={styles.title}>{course.title}</h1>
          <p className={styles.lede}>{course.tagline}</p>
          <dl className={styles.stats}>
            <div>
              <dt>chapters</dt>
              <dd>{chapters.length}</dd>
            </div>
            <div>
              <dt>hours in total</dt>
              <dd>{hours}</dd>
            </div>
            <div>
              <dt>maths needed</dt>
              <dd>JEE</dd>
            </div>
          </dl>
        </div>
        {first ? (
          <Link href={`/learn/${first.slug}`} className={styles.start}>
            <span className={styles.startArt}>
              <LessonArt slug={first.slug} />
            </span>
            <span className={styles.startBody}>
              <span className={styles.startLabel}>Start here · {first.minutes} min</span>
              <span className={styles.startTitle}>{first.title}</span>
              <span className={styles.startSum}>{first.summary}</span>
              <span className={styles.startCta}>
                Start the course <span aria-hidden="true">→</span>
              </span>
            </span>
          </Link>
        ) : null}
      </header>

      <ProgressTrack parts={track} />

      {ready.length < chapters.length ? (
        <p className="small muted">
          {ready.length} of {chapters.length} chapters are written so far. The rest are on the map below and arrive soon.
        </p>
      ) : null}

      {course.parts.map((part, i) => (
        <section key={part.id} className={styles.part} style={partStyle(i)} aria-labelledby={`part-${part.id}`}>
          <header className={styles.partHead}>
            <span className={styles.partId} aria-hidden="true">
              {part.id}
            </span>
            <div>
              <h2 id={`part-${part.id}`} className={styles.partTitle}>
                <span className="sr-only">Part {part.id}: </span>
                {part.title}
              </h2>
              <p className={styles.partBlurb}>{part.blurb}</p>
            </div>
            <span className={styles.partMeta}>
              {part.chapters.length} chapters · {part.chapters.reduce((a, c) => a + c.minutes, 0)} min
            </span>
          </header>
          <ol className={styles.grid}>
            {part.chapters.map((c) => (
              <ChapterCard key={c.slug} chapter={c} level={LEVEL[i] ?? "Advanced"} />
            ))}
          </ol>
        </section>
      ))}

      <section className={styles.part} style={partStyle(1)} aria-labelledby="part-ref">
        <header className={styles.partHead}>
          <span className={styles.partId} aria-hidden="true">
            R
          </span>
          <div>
            <h2 id="part-ref" className={styles.partTitle}>
              Reference
            </h2>
            <p className={styles.partBlurb}>Keep these open in a tab while you read.</p>
          </div>
        </header>
        <ul className={styles.refs}>
          {course.reference.map((r) => (
            <Card key={r.slug} slug={r.slug} ready={r.status === "ready"} art={<LessonArt slug={r.slug} />}>
              <span className={styles.cardTitle}>{r.title}</span>
              <span className={styles.cardSum}>{r.status === "ready" ? r.summary : `${r.summary} Soon.`}</span>
            </Card>
          ))}
        </ul>
      </section>
    </div>
  );
}
