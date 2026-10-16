import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncStarter } from "@/scripts/sync-starter.mjs";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

function repo(source: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starter-"));
  dirs.push(root);
  fs.mkdirSync(path.join(root, "examples"));
  fs.writeFileSync(path.join(root, "examples", "my_agent.py"), source);
  return root;
}

describe("syncStarter", () => {
  it("copies the starter into public/ byte for byte", () => {
    const source = "class Agent:\r\n    pass\r\n";
    const root = repo(source);
    expect(syncStarter(root, { webDir: root })).toEqual({ bytes: source.length });
    expect(fs.readFileSync(path.join(root, "public", "starter", "my_agent.py"), "utf8")).toBe(source);
  });
  it("refuses a starter with no Agent", () => {
    expect(() => syncStarter(repo("print('hi')\n"), { webDir: os.tmpdir() })).toThrow(/no class Agent/);
  });
  it("ships the real starter", () => {
    expect(syncStarter(path.resolve(__dirname, "../../../.."), { webDir: repo("class Agent: pass\n") }).bytes).toBeGreaterThan(0);
  });
});
