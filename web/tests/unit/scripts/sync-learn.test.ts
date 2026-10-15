import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContentError, buildManifest, headings } from "@/scripts/sync-learn.mjs";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

// Builds a small throwaway repo with resources/course.json and the given lesson text.
function repo(lesson: string | null, extra: Partial<{ status: string; second: string }> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "learn-"));
  dirs.push(root);
  const res = path.join(root, "resources");
  fs.mkdirSync(path.join(res, "chapters", "01-first", "code"), { recursive: true });
  const chapters = [{ slug: "01-first", title: "First", summary: "s", minutes: 10, maths: [], status: extra.status ?? "ready" }];
  if (extra.second) chapters.push({ slug: "02-second", title: "Second", summary: "s", minutes: 10, maths: [], status: extra.second });
  fs.writeFileSync(
    path.join(res, "course.json"),
    JSON.stringify({ title: "T", tagline: "t", parts: [{ id: "A", title: "Part", blurb: "b", chapters }], reference: [] }),
  );
  if (lesson !== null) fs.writeFileSync(path.join(res, "chapters", "01-first", "index.mdx"), lesson);
  fs.writeFileSync(path.join(res, "chapters", "01-first", "code", "demo.py"), "print('hi')\n");
  return root;
}

const GOOD = "## Idea\n\nText.\n\n### Detail\n\n## Check yourself\n\nQ.\n\n## Recap\n\nDone.\n";

describe("headings", () => {
  it("slugs headings like rehype-slug and ignores code fences", () => {
    const hs = headings("## Hello, World!\n\n```\n## not a heading\n```\n\n### `code` title\n\n## Hello, World!\n");
    expect(hs.map((h) => h.id)).toEqual(["hello-world", "code-title", "hello-world-1"]);
  });
});

describe("buildManifest", () => {
  it("accepts a good chapter and builds its table of contents and code list", () => {
    const m = buildManifest(repo(GOOD), { write: false });
    expect(m.toc["01-first"].map((t) => t.id)).toEqual(["idea", "detail", "check-yourself", "recap"]);
    expect(m.code["01-first"]).toEqual([{ name: "demo.py", bytes: 12 }]);
  });

  it("writes the lesson, manifest and downloadable code", () => {
    const root = repo(GOOD);
    const web = path.join(root, "web");
    buildManifest(root, { webDir: web });
    expect(fs.existsSync(path.join(web, "generated/learn/pages/01-first.mdx"))).toBe(true);
    expect(fs.existsSync(path.join(web, "generated/learn/manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(web, "public/learn/code/01-first/demo.py"))).toBe(true);
  });

  const bad = (lesson: string | null, extra = {}) => () => buildManifest(repo(lesson, extra), { write: false });

  it("rejects a ready chapter whose file is missing", () => {
    expect(bad(null)).toThrow(ContentError);
    expect(bad(null)).toThrow(/does not exist/);
  });

  it("rejects a chapter without Check yourself or Recap", () => {
    expect(bad("## Idea\n\nText.\n")).toThrow(/Check yourself/);
    expect(bad("## Idea\n\n## Check yourself\n")).toThrow(/Recap/);
  });

  it("rejects TODOs, a title heading and maths in headings", () => {
    expect(bad(GOOD + "\nTODO write this\n")).toThrow(/TODO/);
    expect(bad("# Title\n" + GOOD)).toThrow(/title/);
    expect(bad(GOOD + "\n## The value $q$\n")).toThrow(/maths/);
  });

  it("rejects maths inside a Check question", () => {
    expect(bad(GOOD + '\n<Check q="What is $x^2$?">Answer.</Check>\n')).toThrow(/Check q/);
    expect(() => buildManifest(repo(GOOD + '\n<Check q="What is x²?">It is $x^2$.</Check>\n'), { write: false })).not.toThrow();
  });

  it("rejects links to pages that are not ready", () => {
    expect(bad(GOOD + "\nSee [next](/learn/02-second).\n", { second: "planned" })).toThrow(/does not exist yet/);
    expect(() => buildManifest(repo(GOOD + "\nSee [next](/learn/02-second).\n", { second: "ready" }), { write: false })).toThrow(/does not exist/); // its file is missing
  });

  it("reports a clear message when the resources folder is missing", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "learn-"));
    dirs.push(empty);
    expect(() => buildManifest(empty, { write: false })).toThrow(/Include source files outside/);
  });
});
