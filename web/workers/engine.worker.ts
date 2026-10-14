// The replay engine: Pyodide plus the papersseum wheel, in a Web Worker so the
// page never freezes. Protocol in lib/engine-protocol.ts; the Python calls are
// in lib/engine-runtime.ts (shared with the Node determinism test).
import type { PyodideAPI } from "pyodide";
import { BATCH_FRAMES, type WorkerIn, type WorkerOut } from "@/lib/engine-protocol";
import {
  PYODIDE_CDN, ReplayError, installEngine, openReplay, pythonReason, type EngineManifest, type ReplayRun,
} from "@/lib/engine-runtime";

function post(message: WorkerOut, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer });
}

// no-cache revalidates, so a rebuilt wheel with an unchanged file name is picked up.
async function fetchOk(url: string): Promise<Response> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

let engine: Promise<PyodideAPI> | null = null;

// Loaded once and reused for every replay; a failed load is forgotten so the
// next run (the viewer's Retry) tries again.
function bootEngine(): Promise<PyodideAPI> {
  engine ??= (async () => {
    const url = `${PYODIDE_CDN}pyodide.mjs`;
    const { loadPyodide } = (await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ url)) as typeof import("pyodide");
    const py = await loadPyodide({ indexURL: PYODIDE_CDN });
    const manifest = (await (await fetchOk("/engine/manifest.json")).json()) as EngineManifest;
    const wheel = new Uint8Array(await (await fetchOk(`/engine/${manifest.wheel}`)).arrayBuffer());
    await installEngine(py, manifest, wheel);
    return py;
  })();
  engine.catch(() => {
    engine = null;
  });
  return engine;
}

let current = 0; // the run allowed to keep going; 0 = none
const nextTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function run(id: number, bytes: Uint8Array) {
  post({ type: "status", id, stage: "loading-engine" });
  let py: PyodideAPI;
  try {
    py = await bootEngine();
  } catch (error) {
    post({ type: "error", id, stage: "engine", message: String(error) });
    return;
  }
  if (current !== id) return;
  post({ type: "status", id, stage: "computing" });

  let replay: ReplayRun;
  try {
    replay = openReplay(py, bytes);
  } catch (error) {
    if (error instanceof ReplayError) post({ type: "error", id, stage: "replay", message: error.message });
    else post({ type: "error", id, stage: "run", message: pythonReason(error) });
    return;
  }
  try {
    post({ type: "start", id, header: replay.header, meta: replay.meta }, [replay.header.buffer as ArrayBuffer]);
    for (;;) {
      await nextTurn(); // lets a cancel or a newer run arrive between batches
      if (current !== id) return;
      const batch = replay.nextBatch(BATCH_FRAMES);
      if (!batch) break;
      post({ type: "frames", id, bytes: batch }, [batch.buffer as ArrayBuffer]);
    }
    post({ type: "done", id, result: replay.result() });
  } catch (error) {
    post({ type: "error", id, stage: "run", message: pythonReason(error) });
  } finally {
    replay.close();
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerIn>) => {
  const message = event.data;
  if (message.type === "cancel") {
    if (current === message.id) current = 0;
    return;
  }
  current = message.id;
  void run(message.id, message.bytes);
});
