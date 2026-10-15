// Messages between the page (features/replay/engine-client.ts) and the replay engine
// worker (public/engine/worker.mjs), and the result types both sides share.

export type SeatScore = { pid: number; coverage: number };
export type MatchResult = { scores: SeatScore[]; placements: number[] };

// What the worker learns from a replay before running it. `players` and
// `recorded` come straight from the file, so they are untrusted: read them
// only through seatNames() and parseResult() in features/replay/replay-verdict.ts.
export type ReplayMeta = {
  seed: number;
  engineHash: string | null; // engine that recorded the replay
  shippedHash: string; // engine running in this browser
  players: unknown;
  recorded: unknown;
  frames: number;
};

export type WorkerIn = { type: "run"; id: number; bytes: Uint8Array } | { type: "cancel"; id: number };

export type ErrorStage = "engine" | "replay" | "run";

export type WorkerOut =
  | { type: "status"; id: number; stage: "loading-engine" | "computing" }
  | { type: "start"; id: number; header: Uint8Array; meta: ReplayMeta }
  | { type: "frames"; id: number; bytes: Uint8Array }
  | { type: "done"; id: number; result: MatchResult }
  | { type: "error"; id: number; stage: ErrorStage; message: string };

export { BATCH_FRAMES } from "@/public/engine/runtime.mjs";
