import { readFileSync } from "node:fs";
import { loadPyodide, version, type PyodideAPI } from "pyodide";
import { beforeAll, describe, expect, it } from "vitest";
import { BATCH_FRAMES, type MatchResult } from "@/lib/engine-protocol";
import { PYODIDE_VERSION, ReplayError, installEngine, openReplay, type EngineManifest } from "@/lib/engine-runtime";
import { decodeReplay } from "@/lib/replay-format";

// Runs the committed engine wheel in real Pyodide (numpy is downloaded from the
// Pyodide CDN on first run) and checks it reproduces a natively recorded match.
// This is the guard against Pyodide's numpy diverging from the server's.
const manifest = JSON.parse(readFileSync("public/engine/manifest.json", "utf8")) as EngineManifest;
const fixture = new Uint8Array(readFileSync("lib/fixtures/match.jsonl.gz"));
let py: PyodideAPI;

beforeAll(async () => {
  py = await loadPyodide();
  await installEngine(py, manifest, new Uint8Array(readFileSync(`public/engine/${manifest.wheel}`)));
}, 180_000);

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe("the engine in Pyodide", () => {
  it("is the pinned Pyodide version", () => {
    expect(version).toBe(PYODIDE_VERSION);
  });

  it("runs the shipped engine", () => {
    const run = openReplay(py, fixture);
    expect(run.meta.shippedHash).toBe(manifest.engine_hash);
    expect(run.meta.engineHash).toBe(manifest.engine_hash);
    run.close();
  });

  it("reproduces the recorded match exactly", () => {
    const run = openReplay(py, fixture);
    const parts = [run.header];
    for (let b = run.nextBatch(BATCH_FRAMES); b; b = run.nextBatch(BATCH_FRAMES)) parts.push(b);
    const result = run.result();
    run.close();
    const recorded = run.meta.recorded as MatchResult;
    expect(result.placements).toEqual(recorded.placements);
    expect(result.scores.map((s) => s.coverage)).toEqual(recorded.scores.map((s) => s.coverage));
    expect(decodeReplay(concat(parts)).frames).toBe(run.meta.frames);
  }, 60_000);

  it("refuses a file that isn't a replay, with a reason", () => {
    const bad = new TextEncoder().encode("hello");
    expect(() => openReplay(py, bad)).toThrow(ReplayError);
    expect(() => openReplay(py, bad)).toThrow("it could not be read as a replay file");
  });
});
