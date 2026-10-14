export class ContentError extends Error {}
export function headings(source: string): { depth: number; text: string; id: string; raw: string }[];
export function buildManifest(
  repoRoot: string,
  options?: { write?: boolean; webDir?: string },
): {
  title: string;
  tagline: string;
  parts: { id: string; title: string; blurb: string; chapters: { slug: string; status: string }[] }[];
  reference: { slug: string; status: string }[];
  toc: Record<string, { depth: number; text: string; id: string }[]>;
  code: Record<string, { name: string; bytes: number }[]>;
};
