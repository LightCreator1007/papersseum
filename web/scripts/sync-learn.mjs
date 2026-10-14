// Turns the course in ../resources/ into what the site builds from.
//
//   resources/course.json                      the outline (parts, chapters, status)
//   resources/chapters/<slug>/index.mdx        each lesson
//   resources/chapters/<slug>/code/*           its runnable code
//   resources/glossary.mdx, cheatsheet.mdx     reference pages
//
// Writes (all git-ignored):
//   generated/learn/pages/<slug>.mdx           the lessons, where Next can import them
//   generated/learn/manifest.json              outline + table of contents + code listings
//   public/learn/code/<slug>/*                 downloadable code
//
// It also checks the content and exits non-zero on a problem, so a broken lesson
// fails `npm run build` and CI instead of reaching readers. Runs before dev/build.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, "..");
const STATUSES = new Set(["planned", "ready"]);
const CODE_EXT = new Set([".py", ".txt", ".md", ".json", ".csv"]);

export class ContentError extends Error {}

function fail(problems) {
  throw new ContentError(problems.map((p) => `  - ${p}`).join("\n"));
}

// Heading text as a reader sees it (matches what rehype-slug will slug).
function plain(text) {
  return text.replace(/`/g, "").replace(/\*\*|__|\*|_/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").trim();
}

export function headings(source) {
  const slugger = new GithubSlugger();
  const out = [];
  let fenced = false;
  for (const line of source.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (fenced) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = plain(m[2]);
    out.push({ depth: m[1].length, text, id: slugger.slug(text), raw: m[2] });
  }
  return out;
}

function lintPage(slug, source, isChapter, readySlugs, problems) {
  const where = `${slug}`;
  const hs = headings(source);
  if (hs.some((h) => h.depth === 1)) problems.push(`${where}: do not write a "# title"; the page title comes from course.json`);
  for (const h of hs) {
    if (h.raw.includes("$")) problems.push(`${where}: heading "${h.raw}" contains maths; keep equations out of headings`);
  }
  if (/\bTODO\b|\bFIXME\b|\bTBD\b/.test(source)) problems.push(`${where}: contains TODO/FIXME/TBD`);
  if (isChapter) {
    const h2 = hs.filter((h) => h.depth === 2).map((h) => h.text.toLowerCase());
    for (const needed of ["check yourself", "recap"]) {
      if (!h2.includes(needed)) problems.push(`${where}: missing a "## ${needed[0].toUpperCase() + needed.slice(1)}" section`);
    }
  }
  for (const m of source.matchAll(/\]\(\/learn\/([a-z0-9-]+)(?:#[^)]*)?\)/g)) {
    if (!readySlugs.has(m[1])) problems.push(`${where}: links to /learn/${m[1]}, which does not exist yet (only link to pages that are ready)`);
  }
}

export function buildManifest(repoRoot, { write = true, webDir = WEB } = {}) {
  const resources = path.join(repoRoot, "resources");
  if (!fs.existsSync(path.join(resources, "course.json"))) {
    fail([
      `cannot find ${path.join(resources, "course.json")}.`,
      "On Vercel, turn on Project Settings > General > \"Include source files outside of the Root Directory in the Build Step\".",
    ]);
  }
  const course = JSON.parse(fs.readFileSync(path.join(resources, "course.json"), "utf8"));
  const problems = [];

  const entries = [
    ...course.parts.flatMap((p) => p.chapters.map((c) => ({ ...c, kind: "chapter", file: path.join(resources, "chapters", c.slug, "index.mdx") }))),
    ...course.reference.map((r) => ({ ...r, kind: "reference", file: path.join(resources, `${r.slug}.mdx`) })),
  ];
  const slugs = new Set();
  for (const e of entries) {
    if (!/^[a-z0-9-]+$/.test(e.slug)) problems.push(`slug "${e.slug}" must be lowercase letters, digits and dashes`);
    if (slugs.has(e.slug)) problems.push(`duplicate slug "${e.slug}"`);
    slugs.add(e.slug);
    if (!STATUSES.has(e.status)) problems.push(`${e.slug}: status must be "planned" or "ready"`);
    for (const f of ["title", "summary"]) if (!e[f]) problems.push(`${e.slug}: missing ${f}`);
    if (e.kind === "chapter" && !Number.isInteger(e.minutes)) problems.push(`${e.slug}: minutes must be a whole number`);
  }

  const readySlugs = new Set(entries.filter((e) => e.status === "ready").map((e) => e.slug));
  const toc = {};
  const code = {};
  const pages = [];
  for (const e of entries) {
    if (e.status !== "ready") continue;
    if (!fs.existsSync(e.file)) {
      problems.push(`${e.slug}: marked ready but ${path.relative(repoRoot, e.file)} does not exist`);
      continue;
    }
    const source = fs.readFileSync(e.file, "utf8");
    lintPage(e.slug, source, e.kind === "chapter", readySlugs, problems);
    toc[e.slug] = headings(source)
      .filter((h) => h.depth === 2 || h.depth === 3)
      .map(({ depth, text, id }) => ({ depth, text, id }));
    pages.push({ slug: e.slug, source });
    const codeDir = path.join(resources, "chapters", e.slug, "code");
    if (e.kind === "chapter" && fs.existsSync(codeDir)) {
      code[e.slug] = fs
        .readdirSync(codeDir)
        .filter((f) => CODE_EXT.has(path.extname(f)) && !f.startsWith("_"))
        .sort()
        .map((name) => ({ name, bytes: fs.statSync(path.join(codeDir, name)).size }));
    }
  }
  if (problems.length) fail(problems);

  const manifest = { title: course.title, tagline: course.tagline, parts: course.parts, reference: course.reference, toc, code };
  if (write) {
    const out = path.join(webDir, "generated", "learn");
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(path.join(out, "pages"), { recursive: true });
    for (const p of pages) fs.writeFileSync(path.join(out, "pages", `${p.slug}.mdx`), p.source);
    fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
    const pub = path.join(webDir, "public", "learn", "code");
    fs.rmSync(pub, { recursive: true, force: true });
    for (const [slug, files] of Object.entries(code)) {
      fs.mkdirSync(path.join(pub, slug), { recursive: true });
      for (const f of files) fs.copyFileSync(path.join(resources, "chapters", slug, "code", f.name), path.join(pub, slug, f.name));
    }
  }
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const m = buildManifest(path.resolve(WEB, ".."));
    const ready = m.parts.flatMap((p) => p.chapters).filter((c) => c.status === "ready").length;
    const total = m.parts.flatMap((p) => p.chapters).length;
    console.log(`learn: ${ready}/${total} chapters ready`);
  } catch (e) {
    if (!(e instanceof ContentError)) throw e;
    console.error(`learn: the course has problems:\n${e.message}`);
    process.exit(1);
  }
}
