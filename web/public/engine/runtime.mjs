// @ts-check
// Runs the papersseum engine wheel inside Pyodide. Plain JavaScript (types in
// JSDoc) so the browser can load it unbundled in a module worker
// (public/engine/worker.mjs), and shared with the Node determinism test, so
// both drive the engine through exactly the same calls.

export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

// Frames the worker computes per message.
export const BATCH_FRAMES = 50;

/** @typedef {{ wheel: string; engine_hash: string; version: string }} EngineManifest */

// Python objects as seen from JavaScript (Pyodide proxies): only what we call.
/** @typedef {{ toJs(): Uint8Array; destroy(): void }} PyBytes */
/**
 * @typedef {{
 *   header(): PyBytes;
 *   next_batch(n: number): PyBytes | null | undefined;
 *   meta_json(): string;
 *   result_json(): string;
 *   destroy(): void;
 * }} PyEncoder
 */

/**
 * @typedef {{
 *   meta: import("../../features/replay/engine-protocol").ReplayMeta;
 *   header: Uint8Array;
 *   nextBatch(frames: number): Uint8Array | null;
 *   result(): import("../../features/replay/engine-protocol").MatchResult;
 *   close(): void;
 * }} ReplayRun
 */

// A replay the engine refused to read; the message says why, in plain words.
export class ReplayError extends Error {}

/**
 * @param {import("pyodide").PyodideAPI} py
 * @param {EngineManifest} manifest
 * @param {Uint8Array} wheel
 * @returns {Promise<void>}
 */
export async function installEngine(py, manifest, wheel) {
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
/**
 * @param {unknown} error
 * @returns {string}
 */
export function pythonReason(error) {
  const text = error instanceof Error ? error.message : String(error);
  const last = text.trim().split("\n").at(-1) ?? text;
  return last.replace(/^[A-Za-z_.]*(Error|Exception): /, "");
}

/**
 * @param {PyBytes} proxy
 * @returns {Uint8Array}
 */
function takeBytes(proxy) {
  try {
    return proxy.toJs();
  } finally {
    proxy.destroy();
  }
}

/**
 * @param {import("pyodide").PyodideAPI} py
 * @param {Uint8Array} bytes
 * @returns {ReplayRun}
 */
export function openReplay(py, bytes) {
  const frames = py.pyimport("papersseum.frames");
  /** @type {PyEncoder} */
  let encoder;
  try {
    encoder = /** @type {PyEncoder} */ (frames.open_replay(bytes));
  } catch (error) {
    if (/** @type {{ type?: string }} */ (error).type === "ValueError") throw new ReplayError(pythonReason(error));
    throw error;
  } finally {
    frames.destroy();
  }
  try {
    const meta = JSON.parse(encoder.meta_json());
    const header = takeBytes(encoder.header());
    return {
      meta,
      header,
      nextBatch: (n) => {
        const batch = encoder.next_batch(n);
        return batch == null ? null : takeBytes(batch);
      },
      result: () => JSON.parse(encoder.result_json()),
      close: () => encoder.destroy(),
    };
  } catch (error) {
    encoder.destroy();
    throw error;
  }
}
