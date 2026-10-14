// Runs the papersseum engine wheel inside Pyodide. Shared by the browser worker
// (workers/engine.worker.ts) and the Node determinism test, so both drive the
// engine through exactly the same calls.
import type { PyodideAPI } from "pyodide";
import type { MatchResult, ReplayMeta } from "@/lib/engine-protocol";

export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export type EngineManifest = { wheel: string; engine_hash: string; version: string };

// Python objects as seen from JavaScript (Pyodide proxies): only what we call.
type PyBytes = { toJs(): Uint8Array; destroy(): void };
type PyEncoder = {
  header(): PyBytes;
  next_batch(n: number): PyBytes | null | undefined;
  meta_json(): string;
  result_json(): string;
  destroy(): void;
};

// A replay the engine refused to read; the message says why, in plain words.
export class ReplayError extends Error {}

export async function installEngine(py: PyodideAPI, manifest: EngineManifest, wheel: Uint8Array): Promise<void> {
  await py.loadPackage(["numpy", "micropip"]);
  const path = `/tmp/${manifest.wheel}`;
  py.FS.writeFile(path, wheel);
  const micropip = py.pyimport("micropip");
  try {
    await micropip.install(`emfs:${path}`);
  } finally {
    micropip.destroy();
  }
}

// "Traceback ...\nValueError: it has no moves" -> "it has no moves"
export function pythonReason(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const last = text.trim().split("\n").at(-1) ?? text;
  return last.replace(/^[A-Za-z_.]*(Error|Exception): /, "");
}

function takeBytes(proxy: PyBytes): Uint8Array {
  try {
    return proxy.toJs();
  } finally {
    proxy.destroy();
  }
}

export type ReplayRun = {
  meta: ReplayMeta;
  header: Uint8Array;
  nextBatch(frames: number): Uint8Array | null;
  result(): MatchResult;
  close(): void;
};

export function openReplay(py: PyodideAPI, bytes: Uint8Array): ReplayRun {
  const frames = py.pyimport("papersseum.frames");
  let encoder: PyEncoder;
  try {
    encoder = frames.open_replay(bytes) as PyEncoder;
  } catch (error) {
    if ((error as { type?: string }).type === "ValueError") throw new ReplayError(pythonReason(error));
    throw error;
  } finally {
    frames.destroy();
  }
  try {
    const meta = JSON.parse(encoder.meta_json()) as ReplayMeta;
    const header = takeBytes(encoder.header());
    return {
      meta,
      header,
      nextBatch: (n) => {
        const batch = encoder.next_batch(n);
        return batch == null ? null : takeBytes(batch);
      },
      result: () => JSON.parse(encoder.result_json()) as MatchResult,
      close: () => encoder.destroy(),
    };
  } catch (error) {
    encoder.destroy();
    throw error;
  }
}
