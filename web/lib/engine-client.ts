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
  const listeners = new Map<number, (m: WorkerOut) => void>();

  const deliver = (m: WorkerOut) => {
    const listener = listeners.get(m.id);
    if (!listener) return;
    if (m.type === "done" || m.type === "error") listeners.delete(m.id);
    listener(m);
  };

  const getWorker = (): WorkerLike => {
    if (worker) return worker;
    const w = makeWorker();
    w.addEventListener("message", (e) => deliver((e as MessageEvent<WorkerOut>).data));
    w.addEventListener("error", () => {
      // The worker itself died. Fail every open run and start a fresh worker
      // next time, so the viewer's Retry really retries.
      w.terminate();
      if (worker === w) worker = null;
      for (const id of [...listeners.keys()]) {
        deliver({ type: "error", id, stage: "engine", message: "the replay engine stopped" });
      }
    });
    worker = w;
    return w;
  };

  return {
    run(bytes, onMessage) {
      const id = nextId++;
      listeners.set(id, onMessage);
      const fail = () => {
        // Report it as an error message (after run() has returned its cancel).
        listeners.delete(id);
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
      try {
        w.postMessage({ type: "run", id, bytes } satisfies WorkerIn);
      } catch {
        // This run's message could not be sent; the worker and other runs are fine.
        fail();
      }
      return () => {
        if (listeners.delete(id)) worker?.postMessage({ type: "cancel", id } satisfies WorkerIn);
      };
    },
  };
}

let shared: EngineClient | null = null;

export function engineClient(): EngineClient {
  // A plain URL, not bundled: Pyodide 314 needs a module worker, and Turbopack's workers are classic.
  shared ??= createEngineClient(() => new Worker("/engine/worker.mjs", { type: "module" }));
  return shared;
}
