import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOC_PAGES, docNeighbours, findDoc } from "@/lib/docs/manifest";

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug.split("/") }));
}

export async function generateMetadata({ params }: PageProps<"/docs/[...slug]">): Promise<Metadata> {
  const doc = findDoc((await params).slug);
  return doc ? { title: doc.title } : {};
}

export default async function DocPage({ params }: PageProps<"/docs/[...slug]">) {
  const doc = findDoc((await params).slug);
  if (!doc) notFound();
  const { default: Body } = await import(`@/generated/docs/pages/${doc.file}.mdx`);
  const { prev, next } = docNeighbours(doc.slug);

  return (
    <article className="lesson">
      <p className="crumbs">
        <Link href="/docs">Docs</Link> › {doc.group}
      </p>
      <div className="lesson-body">
        <Body />
      </div>
      <nav className="lesson-nav" aria-label="Previous and next">
        {prev ? <Link href={`/docs/${prev.slug}`} rel="prev">← {prev.title}</Link> : <span />}
        {next ? <Link href={`/docs/${next.slug}`} rel="next">{next.title} →</Link> : <span />}
      </nav>
    </article>
  );
}
