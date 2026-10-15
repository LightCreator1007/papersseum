import manifest from "@/generated/docs/manifest.json";
import type { TocItem } from "@/features/learn/manifest";

export type DocPage = { slug: string; group: string; title: string; file: string; toc: TocItem[] };

export const DOC_PAGES: DocPage[] = manifest;

export const GETTING_STARTED: Pick<DocPage, "slug" | "group" | "title"> = {
  slug: "getting-started",
  group: "Start here",
  title: "Getting started",
};

export function findDoc(slug: string[]): DocPage | null {
  const key = slug.join("/");
  return DOC_PAGES.find((p) => p.slug === key) ?? null;
}

export function docGroups() {
  const all = [GETTING_STARTED, ...DOC_PAGES];
  const groups = new Map<string, { slug: string; title: string }[]>();
  for (const p of all) groups.set(p.group, [...(groups.get(p.group) ?? []), { slug: p.slug, title: p.title }]);
  return [...groups].map(([group, pages]) => ({ group, pages }));
}

export function docNeighbours(slug: string) {
  const all = docGroups().flatMap((g) => g.pages);
  const i = all.findIndex((p) => p.slug === slug);
  return { prev: i > 0 ? all[i - 1] : null, next: i >= 0 && i < all.length - 1 ? all[i + 1] : null };
}
