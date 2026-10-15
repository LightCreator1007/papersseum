export const COMPETITION_SLUGS: string[];
export function splitSections(source: string): string[];
export function buildDocs(
  repoRoot: string,
  opts?: { write?: boolean; webDir?: string },
): { slug: string; group: string; title: string; file: string; source: string; toc: { depth: number; text: string; id: string }[] }[];
