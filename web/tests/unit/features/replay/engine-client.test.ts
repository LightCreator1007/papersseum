import { describe, expect, it } from "vitest";
import type { WorkerIn, WorkerOut } from "@/features/replay/engine-protocol";
import { createEngineClient } from "@/features/replay/engine-client";

class FakeWorker {
  sent: WorkerIn[] = [];
  terminated = false;
  private handlers: Record<string, ((e: unknown) => void)[]> = {};
  postMessage(m: WorkerIn) {
    this.sent.push(m);
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    (this.handlers[type] ??= []).push(fn);
  }
  terminate() {
    this.terminated = true;
  }
  reply(m: WorkerOut) {
    for (const fn of this.handlers.message ?? []) fn({ data: m });
  }
  crash() {
    for (const fn of this.handlers.error ?? []) fn({});
  }
}

function setup() {
  const workers: FakeWorker[] = [];
  const client = createEngineClient(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w as unknown as Worker;
  });
  return { client, workers };
}

const bytes = new Uint8Array([1, 2, 3]);

describe("engine client", () => {
  it("starts one worker and numbers each run", () => {
    const { client, workers } = setup();
    client.run(bytes, () => {});
    client.run(bytes, () => {});
    expect(workers).toHaveLength(1);
    expect(workers[0].sent).toEqual([{ type: "run", id: 1, bytes }, { type: "run", id: 2, bytes }]);
  });

  it("delivers a run's messages only to that run", () => {
    const { client, workers } = setup();
    const a: WorkerOut[] = [];
    const b: WorkerOut[] = [];
    client.run(bytes, (m) => a.push(m));
    client.run(bytes, (m) => b.push(m));
    workers[0].reply({ type: "status", id: 2, stage: "computing" });
    expect(a).toEqual([]);
    expect(b).toEqual([{ type: "status", id: 2, stage: "computing" }]);
  });

  it("drops late messages from a cancelled run and tells the worker", () => {
    const { client, workers } = setup();
    const got: WorkerOut[] = [];
    const cancel = client.run(bytes, (m) => got.push(m));
    cancel();
    workers[0].reply({ type: "frames", id: 1, bytes });
    expect(got).toEqual([]);
    expect(workers[0].sent.at(-1)).toEqual({ type: "cancel", id: 1 });
    cancel(); // a second cancel is harmless and sends nothing
    expect(workers[0].sent.filter((m) => m.type === "cancel")).toHaveLength(1);
  });

  it("forgets a run once it is done", () => {
    const { client, workers } = setup();
    const got: WorkerOut[] = [];
    client.run(bytes, (m) => got.push(m));
    workers[0].reply({ type: "done", id: 1, result: { scores: [], placements: [] } });
    workers[0].reply({ type: "status", id: 1, stage: "computing" });
    expect(got.map((m) => m.type)).toEqual(["done"]);
  });

  it("fails open runs when the worker crashes, then starts a fresh worker", () => {
    const { client, workers } = setup();
    const got: WorkerOut[] = [];
    client.run(bytes, (m) => got.push(m));
    workers[0].crash();
    expect(got).toEqual([{ type: "error", id: 1, stage: "engine", message: "the replay engine stopped" }]);
    expect(workers[0].terminated).toBe(true);
    client.run(bytes, () => {});
    expect(workers).toHaveLength(2);
    expect(workers[1].sent).toEqual([{ type: "run", id: 2, bytes }]);
  });

  it("replaces the worker after an engine-load failure, failing its other open runs", () => {
    const { client, workers } = setup();
    const a: WorkerOut[] = [];
    const b: WorkerOut[] = [];
    client.run(bytes, (m) => a.push(m));
    client.run(bytes, (m) => b.push(m));
    const failure: WorkerOut = { type: "error", id: 1, stage: "engine", message: "TypeError: Failed to fetch" };
    workers[0].reply(failure);
    expect(a).toEqual([failure]);
    expect(b).toEqual([{ ...failure, id: 2 }]);
    expect(workers[0].terminated).toBe(true);
    client.run(bytes, () => {});
    expect(workers).toHaveLength(2);
    expect(workers[1].sent).toEqual([{ type: "run", id: 3, bytes }]);
    workers[0].reply({ type: "error", id: 2, stage: "engine", message: "late" }); // already failed
    expect(b).toHaveLength(1);
  });

  it("replaces the worker after an engine-load failure even if that run was cancelled", () => {
    const { client, workers } = setup();
    const cancel = client.run(bytes, () => {});
    cancel();
    workers[0].reply({ type: "error", id: 1, stage: "engine", message: "TypeError: Failed to fetch" });
    expect(workers[0].terminated).toBe(true);
    client.run(bytes, () => {});
    expect(workers).toHaveLength(2);
  });

  it("keeps the worker after a replay or run error", () => {
    const { client, workers } = setup();
    const b: WorkerOut[] = [];
    client.run(bytes, () => {});
    client.run(bytes, (m) => b.push(m));
    workers[0].reply({ type: "error", id: 1, stage: "replay", message: "not a replay" });
    workers[0].reply({ type: "error", id: 1, stage: "run", message: "boom" });
    expect(workers[0].terminated).toBe(false);
    expect(b).toEqual([]);
    client.run(bytes, () => {});
    expect(workers).toHaveLength(1);
  });

  it("does not fail runs on a newer worker when an old worker reports an engine error", () => {
    const { client, workers } = setup();
    client.run(bytes, () => {});
    workers[0].crash();
    const b: WorkerOut[] = [];
    client.run(bytes, (m) => b.push(m));
    workers[0].reply({ type: "error", id: 1, stage: "engine", message: "late" });
    expect(b).toEqual([]);
    expect(workers[1].terminated).toBe(false);
  });

  it("reports a worker that cannot start as an error, then retries", async () => {
    const workers: FakeWorker[] = [];
    let calls = 0;
    const client = createEngineClient(() => {
      if (++calls === 1) throw new Error("no module workers");
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    });
    const got: WorkerOut[] = [];
    let cancel = () => {};
    expect(() => {
      cancel = client.run(bytes, (m) => got.push(m));
    }).not.toThrow();
    expect(got).toEqual([]);
    await Promise.resolve();
    expect(got).toEqual([{ type: "error", id: 1, stage: "engine", message: "the replay engine could not start" }]);
    cancel(); // harmless no-op
    client.run(bytes, () => {});
    expect(workers).toHaveLength(1);
    expect(workers[0].sent).toEqual([{ type: "run", id: 2, bytes }]);
  });

  it("fails only the run whose message cannot be posted", async () => {
    const { client, workers } = setup();
    const a: WorkerOut[] = [];
    const b: WorkerOut[] = [];
    client.run(bytes, (m) => a.push(m));
    workers[0].postMessage = () => {
      throw new Error("DataCloneError");
    };
    expect(() => client.run(bytes, (m) => b.push(m))).not.toThrow();
    await Promise.resolve();
    expect(b).toEqual([{ type: "error", id: 2, stage: "engine", message: "the replay engine could not start" }]);
    workers[0].reply({ type: "status", id: 1, stage: "computing" });
    expect(a).toEqual([{ type: "status", id: 1, stage: "computing" }]);
    expect(workers).toHaveLength(1);
    expect(workers[0].terminated).toBe(false);
  });
});
