import raw from "@/generated/learn/manifest.json";

export type Status = "planned" | "ready";
export type Chapter = {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  maths: string[];
  status: Status;
};
export type Part = { id: string; title: string; blurb: string; chapters: Chapter[] };
export type Reference = { slug: string; title: string; summary: string; status: Status };
export type TocItem = { depth: number; text: string; id: string };
export type CodeFile = { name: string; bytes: number };

export const course = raw as unknown as {
  title: string;
  tagline: string;
  parts: Part[];
  reference: Reference[];
  toc: Record<string, TocItem[]>;
  code: Record<string, CodeFile[]>;
};

export type Page =
  | { kind: "chapter"; part: Part; chapter: Chapter }
  | { kind: "reference"; reference: Reference };

// Every page that exists, in reading order: chapters, then the reference pages.
export function readyPages(): Page[] {
  const chapters = course.parts.flatMap((part) =>
    part.chapters.filter((c) => c.status === "ready").map((chapter): Page => ({ kind: "chapter", part, chapter })),
  );
  const refs = course.reference.filter((r) => r.status === "ready").map((reference): Page => ({ kind: "reference", reference }));
  return [...chapters, ...refs];
}

export function slugOf(page: Page): string {
  return page.kind === "chapter" ? page.chapter.slug : page.reference.slug;
}

export function titleOf(page: Page): string {
  return page.kind === "chapter" ? page.chapter.title : page.reference.title;
}

export function findPage(slug: string): Page | undefined {
  return readyPages().find((p) => slugOf(p) === slug);
}

export function neighbours(slug: string): { prev?: Page; next?: Page } {
  const pages = readyPages();
  const i = pages.findIndex((p) => slugOf(p) === slug);
  return { prev: i > 0 ? pages[i - 1] : undefined, next: i >= 0 && i < pages.length - 1 ? pages[i + 1] : undefined };
}

export function chapterNumber(slug: string): string {
  const m = /^(\d+)-/.exec(slug);
  return m ? String(Number(m[1])) : "";
}
