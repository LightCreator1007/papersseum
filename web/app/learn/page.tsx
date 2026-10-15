import type { Metadata } from "next";
import Link from "next/link";
import { course } from "@/features/learn/manifest";

export const metadata: Metadata = {
  title: "Learn",
  description: "A free, beginner-friendly course on reinforcement learning. JEE Mains maths is all you need.",
};

export default function LearnHome() {
  const chapters = course.parts.flatMap((p) => p.chapters);
  const ready = chapters.filter((c) => c.status === "ready").length;
  const minutes = chapters.reduce((a, c) => a + c.minutes, 0);
  const hours = Math.round(minutes / 60);

  return (
    <div className="learn-home">
      <p className="crumbs">Learn</p>
      <h1>{course.title}</h1>
      <p className="lede learn-lede">{course.tagline}</p>

      <ul className="learn-facts">
        <li>
          <strong>{chapters.length}</strong> chapters, about <strong>{hours} hours</strong> in total
        </li>
        <li>Maths up to JEE Mains, taught as you need it</li>
        <li>Free, open to everyone, no sign-in</li>
      </ul>
      {ready < chapters.length ? (
        <p className="small muted">
          {ready} of {chapters.length} chapters are written so far. The rest are on the map below and arrive soon.
        </p>
      ) : null}

      {course.parts.map((part) => (
        <section key={part.id} className="learn-part">
          <h2>
            Part {part.id}: {part.title}
          </h2>
          <p className="muted small">{part.blurb}</p>
          <ol className="learn-chapters">
            {part.chapters.map((c) => {
              const n = Number(c.slug.split("-")[0]);
              const body = (
                <>
                  <span className="chapter-no">{n}</span>
                  <span className="chapter-main">
                    <span className="chapter-title">{c.title}</span>
                    <span className="chapter-sum">{c.summary}</span>
                  </span>
                  <span className="chapter-min">{c.status === "ready" ? `${c.minutes} min` : "soon"}</span>
                </>
              );
              return (
                <li key={c.slug} className={c.status === "ready" ? "chapter" : "chapter chapter-soon"}>
                  {c.status === "ready" ? <Link href={`/learn/${c.slug}`}>{body}</Link> : <div>{body}</div>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <section className="learn-part">
        <h2>Reference</h2>
        <ol className="learn-chapters">
          {course.reference.map((r) => (
            <li key={r.slug} className={r.status === "ready" ? "chapter" : "chapter chapter-soon"}>
              {r.status === "ready" ? (
                <Link href={`/learn/${r.slug}`}>
                  <span className="chapter-no">·</span>
                  <span className="chapter-main">
                    <span className="chapter-title">{r.title}</span>
                    <span className="chapter-sum">{r.summary}</span>
                  </span>
                </Link>
              ) : (
                <div>
                  <span className="chapter-no">·</span>
                  <span className="chapter-main">
                    <span className="chapter-title">{r.title}</span>
                    <span className="chapter-sum">{r.summary}</span>
                  </span>
                  <span className="chapter-min">soon</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
