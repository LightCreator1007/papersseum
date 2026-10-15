// The page's side of the replay engine: one worker per page, created on first
// use. Each run gets an id; messages for cancelled or finished runs are dropped.
import type { WorkerIn, WorkerOut } from "@/lib/engine-protocol";

type WorkerLike = Pick<Worker, "postMessage" | "addEventListener" | "terminate">;

export type EngineClient = {
  // Returns cancel(): stops the run and silences its remaining messages.
  run(bytes: Uint8Array, onMessage: (m: WorkerOut) => void): () => void;
};

export function createEngineClient(makeWorker: () => WorkerLike): EngineClient {
  let worker: WorkerLike | null = null;
  let nextId = 1;
  // Each open run, with the worker it was sent to (null if none could start).
  const runs = new Map<number, { onMessage: (m: WorkerOut) => void; worker: WorkerLike | null }>();

  const deliver = (m: WorkerOut) => {
    const run = runs.get(m.id);
    if (!run) return;
    if (m.type === "done" || m.type === "error") runs.delete(m.id);
    run.onMessage(m);
  };

  // Throw a worker away and fail every run still open on it. A fresh worker is
  // made on the next run, so the viewer's Retry really retries.
  const retire = (w: WorkerLike, message: string) => {
    w.terminate();
    if (worker === w) worker = null;
    for (const [id, run] of [...runs]) {
      if (run.worker === w) deliver({ type: "error", id, stage: "engine", message });
    }
  };

  const getWorker = (): WorkerLike => {
    if (worker) return worker;
    const w = makeWorker();
    w.addEventListener("message", (e) => {
      const m = (e as MessageEvent<WorkerOut>).data;
      const from = runs.get(m.id)?.worker;
      deliver(m);
      // The engine failed to load (offline, CDN down...). Its runs share that
      // failed boot, and the worker may keep failing (a failed module import
      // is cached, Pyodide may be half set up), so replace it.
      if (m.type === "error" && m.stage === "engine" && from === w) retire(w, m.message);
    });
    // The worker itself died.
    w.addEventListener("error", () => retire(w, "the replay engine stopped"));
    worker = w;
    return w;
  };

  return {
    run(bytes, onMessage) {
      const id = nextId++;
      const fail = () => {
        // Report it as an error message (after run() has returned its cancel).
        runs.delete(id);
        queueMicrotask(() =>
          onMessage({ type: "error", id, stage: "engine", message: "the replay engine could not start" }),
        );
      };
      let w: WorkerLike;
      try {
        w = getWorker();
      } catch {
        // No Worker support: nothing was created, so a later run tries afresh.
        fail();
        return () => {};
      }
      runs.set(id, { onMessage, worker: w });
      try {
        w.postMessage({ type: "run", id, bytes } satisfies WorkerIn);
      } catch {
        // This run's message could not be sent; the worker and other runs are fine.
        fail();
      }
      return () => {
        if (runs.delete(id)) w.postMessage({ type: "cancel", id } satisfies WorkerIn);
      };
    },
  };
}

let shared: EngineClient | null = null;

// The page's one engine. It runs one replay at a time: a newer run supersedes
// an earlier one that wasn't cancelled, which then gets no more messages (the
// worker stops it between batches). Viewers cancel their run when they unmount.
export function engineClient(): EngineClient {
  // A plain URL, not bundled: Pyodide 314 needs a module worker, and Turbopack's workers are classic.
  shared ??= createEngineClient(() => new Worker("/engine/worker.mjs", { type: "module" }));
  return shared;
}
