import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Toc } from "@/features/learn/components/toc";
import { chapterNumber, course, findPage, neighbours, readyPages, slugOf, titleOf } from "@/features/learn/manifest";

export function generateStaticParams() {
  return readyPages().map((p) => ({ slug: slugOf(p) }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = findPage(slug);
  if (!page) return {};
  return {
    title: titleOf(page),
    description: page.kind === "chapter" ? page.chapter.summary : page.reference.summary,
  };
}

export default async function LessonPage({ params }: PageProps<"/learn/[slug]">) {
  const { slug } = await params;
  const page = findPage(slug);
  if (!page) notFound(); // pages not in generateStaticParams are served on request, so unknown slugs need an explicit 404

  const { default: Lesson } = await import(`@/generated/learn/pages/${slug}.mdx`);
  const { prev, next } = neighbours(slug);
  const toc = course.toc[slug] ?? [];
  const code = course.code[slug] ?? [];
  const title = titleOf(page);

  return (
    <div className="lesson-layout">
      <article className="lesson">
        <p className="crumbs">
          <Link href="/learn">Learn</Link>
          {page.kind === "chapter" ? ` › Part ${page.part.id}: ${page.part.title}` : " › Reference"}
        </p>
        <h1>{page.kind === "chapter" ? `${chapterNumber(slug)}. ${title}` : title}</h1>
        {page.kind === "chapter" ? (
          <p className="lesson-meta small muted">
            About {page.chapter.minutes} minutes
            {page.chapter.maths.length ? ` · Maths used: ${page.chapter.maths.join(", ")}` : " · No maths needed"}
          </p>
        ) : null}

        <div className="lesson-body">
          <Lesson />
        </div>

        {code.length ? (
          <section className="lesson-code">
            <h2>Code for this chapter</h2>
            <p className="small muted">Run these on your own machine. Each one is short and commented.</p>
            <ul className="list-plain">
              {code.map((f) => (
                <li key={f.name}>
                  <a href={`/learn/code/${slug}/${f.name}`} download>
                    {f.name}
                  </a>{" "}
                  <span className="muted small">{(f.bytes / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav className="lesson-nav" aria-label="Previous and next">
          {prev ? (
            <Link href={`/learn/${slugOf(prev)}`} rel="prev">
              ← {titleOf(prev)}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/learn/${slugOf(next)}`} rel="next">
              {titleOf(next)} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
      <aside className="lesson-aside">
        <Toc items={toc} />
      </aside>
    </div>
  );
}
