import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { COMPETITION_SLUGS, buildDocs, splitSections } from "@/scripts/sync-docs.mjs";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");

describe("docs re-presentation", () => {
  it("splits COMPETITION.md into pages that rejoin to the exact source", () => {
    const source = fs.readFileSync(path.join(ROOT, "COMPETITION.md"), "utf8");
    expect(splitSections(source).join("")).toBe(source);
  });
  it("builds one page per section plus overview and package", () => {
    const pages = buildDocs(ROOT, { write: false });
    expect(pages.map((p) => p.slug)).toEqual([
      "competition",
      ...COMPETITION_SLUGS.map((s) => `competition/${s}`),
      "package",
    ]);
    const faq = pages.find((p) => p.slug === "competition/faq");
    expect(faq?.source.match(/^\*\*.+\*\*/gm)?.length).toBeGreaterThanOrEqual(9);
  });
});
