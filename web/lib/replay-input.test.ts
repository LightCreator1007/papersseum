import { describe, expect, it } from "vitest";
import { MAX_REPLAY_BYTES, replayFileProblem } from "@/lib/replay-input";

describe("replayFileProblem", () => {
  it("accepts a normal replay", () => {
    expect(replayFileProblem({ size: 1200 })).toBeNull();
    expect(replayFileProblem({ size: MAX_REPLAY_BYTES })).toBeNull();
  });
  it("refuses empty and oversized files before reading them", () => {
    expect(replayFileProblem({ size: 0 })).toBe("That file is empty.");
    expect(replayFileProblem({ size: MAX_REPLAY_BYTES + 1 })).toBe(
      "That file is too big to be a replay; real ones are a few KB.",
    );
  });
});
