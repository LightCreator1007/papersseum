// Re-presents the participant resources under /docs without changing them.
//
//   ../COMPETITION.md   split at each "## " heading into one page per section
//   ../README.md        the package page, whole
//
// Writes (git-ignored): generated/docs/pages/<slug>.mdx and generated/docs/manifest.json.
// The split is checked: the sections joined back together must equal the source
// byte for byte, so a page can never drop or alter text. Runs before dev/build.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { headings } from "./sync-learn.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const REPO_URL = "https://github.com/dhairya-pandya/papersseum/blob/main";

export const COMPETITION_SLUGS = [
  "quick-start", "the-game", "what-you-submit", "how-it-runs", "sandbox", "deep-learning", "commands", "faq",
];

export function splitSections(source) {
  const lines = source.split(/(?<=\n)/);
  const parts = [[]];
  let fenced = false;
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced && /^## /.test(line)) parts.push([]);
    parts[parts.length - 1].push(line);
  }
  return parts.map((p) => p.join(""));
}

// Relative links point at files in the repository; send them to GitHub.
// Only the link target changes, never the text a reader sees.
function absoluteLinks(md) {
  return md.replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (_m, target) => `](${REPO_URL}/${target})`);
}

// The pages compile as MDX, where a bare "<" or "{" in prose starts JSX. Code
// fences and inline code are safe. Fail loudly rather than render broken text.
function checkMdxSafe(name, md) {
  let fenced = false;
  md.split("\n").forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) return;
    if (/[<{]/.test(line.replace(/`[^`]*`/g, ""))) throw new Error(`docs: ${name} line ${i + 1} has "<" or "{" outside code`);
  });
}

function titleOf(section) {
  const m = /^#{1,2}\s+(.+)$/m.exec(section);
  return m ? m[1].replace(/^\d+\.\s*/, "").trim() : "";
}

export function buildDocs(repoRoot, { write = true, webDir = WEB } = {}) {
  const competition = fs.readFileSync(path.join(repoRoot, "COMPETITION.md"), "utf8");
  const readme = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
  checkMdxSafe("COMPETITION.md", competition);
  checkMdxSafe("README.md", readme);
  const sections = splitSections(competition);
  if (sections.join("") !== competition) throw new Error("docs: COMPETITION.md split lost text");
  if (sections.length - 1 !== COMPETITION_SLUGS.length) {
    throw new Error(`docs: COMPETITION.md has ${sections.length - 1} sections, expected ${COMPETITION_SLUGS.length}`);
  }
  const pages = [
    { slug: "competition", group: "Competition", title: "Overview", source: sections[0] },
    ...COMPETITION_SLUGS.map((slug, i) => ({
      slug: `competition/${slug}`, group: "Competition", title: titleOf(sections[i + 1]), source: sections[i + 1],
    })),
    { slug: "package", group: "Package", title: "The papersseum package", source: readme },
  ].map((p) => ({ ...p, file: p.slug.replace("/", "--"), toc: headings(p.source).filter((h) => h.depth === 2 || h.depth === 3) }));

  if (write) {
    const out = path.join(webDir, "generated", "docs");
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(path.join(out, "pages"), { recursive: true });
    for (const p of pages) fs.writeFileSync(path.join(out, "pages", `${p.file}.mdx`), absoluteLinks(p.source));
    const manifest = pages.map(({ source: _s, ...rest }) => rest);
    fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  }
  return pages;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pages = buildDocs(path.resolve(WEB, ".."));
  console.log(`docs: ${pages.length} pages`);
}
