// @ts-check
// The replay engine: Pyodide plus the papersseum wheel, in a module Web Worker
// so the page never freezes. Served as-is from public/ (not bundled: Pyodide
// 314 refuses classic workers). Protocol in features/replay/engine-protocol.ts; the Python
// calls are in ./runtime.mjs (shared with the Node determinism test).
import { BATCH_FRAMES, PYODIDE_CDN, ReplayError, installEngine, openReplay, pythonReason } from "./runtime.mjs";

/** @typedef {import("pyodide").PyodideAPI} PyodideAPI */
/** @typedef {import("./runtime.mjs").EngineManifest} EngineManifest */
/** @typedef {import("./runtime.mjs").ReplayRun} ReplayRun */
/** @typedef {import("../../features/replay/engine-protocol").WorkerIn} WorkerIn */
/** @typedef {import("../../features/replay/engine-protocol").WorkerOut} WorkerOut */

/**
 * @param {WorkerOut} message
 * @param {Transferable[]} [transfer]
 */
function post(message, transfer = []) {
  self.postMessage(message, { transfer });
}

// no-cache revalidates, so a rebuilt wheel with an unchanged file name is picked up.
/**
 * @param {string} url
 * @returns {Promise<Response>}
 */
async function fetchOk(url) {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

/** @type {Promise<PyodideAPI> | null} */
let engine = null;

// Loaded once and reused for every replay; a failed load is forgotten so the
// next run (the viewer's Retry) tries again.
/** @returns {Promise<PyodideAPI>} */
function bootEngine() {
  const booting = (engine ??= (async () => {
    const { loadPyodide } = await import(PYODIDE_CDN + "pyodide.mjs");
    const py = await loadPyodide({ indexURL: PYODIDE_CDN });
    const manifest = /** @type {EngineManifest} */ (await (await fetchOk("/engine/manifest.json")).json());
    const wheel = new Uint8Array(await (await fetchOk(`/engine/${manifest.wheel}`)).arrayBuffer());
    await installEngine(py, manifest, wheel);
    return py;
  })());
  booting.catch(() => {
    engine = null;
  });
  return booting;
}

let current = 0; // the run allowed to keep going; 0 = none
const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * @param {number} id
 * @param {Uint8Array} bytes
 */
async function run(id, bytes) {
  post({ type: "status", id, stage: "loading-engine" });
  /** @type {PyodideAPI} */
  let py;
  try {
    py = await bootEngine();
  } catch (error) {
    post({ type: "error", id, stage: "engine", message: String(error) });
    return;
  }
  if (current !== id) return;
  post({ type: "status", id, stage: "computing" });

  /** @type {ReplayRun} */
  let replay;
  try {
    replay = openReplay(py, bytes);
  } catch (error) {
    if (error instanceof ReplayError) post({ type: "error", id, stage: "replay", message: error.message });
    else post({ type: "error", id, stage: "run", message: pythonReason(error) });
    return;
  }
  try {
    post({ type: "start", id, header: replay.header, meta: replay.meta }, [replay.header.buffer]);
    for (;;) {
      await nextTurn(); // lets a cancel or a newer run arrive between batches
      if (current !== id) return;
      const batch = replay.nextBatch(BATCH_FRAMES);
      if (!batch) break;
      post({ type: "frames", id, bytes: batch }, [batch.buffer]);
    }
    post({ type: "done", id, result: replay.result() });
  } catch (error) {
    post({ type: "error", id, stage: "run", message: pythonReason(error) });
  } finally {
    replay.close();
  }
}

self.addEventListener("message", (event) => {
  const message = /** @type {MessageEvent<WorkerIn>} */ (event).data;
  if (message.type === "cancel") {
    if (current === message.id) current = 0;
    return;
  }
  current = message.id;
  void run(message.id, message.bytes);
});
