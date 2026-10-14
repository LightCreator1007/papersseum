import { describe, expect, it } from "vitest";
import type { MatchResult } from "@/lib/engine-protocol";
import { parseResult, seatNames, verdict, verdictText, type ExpectedSeat } from "@/lib/replay-verdict";

const HASH = "94534ca788048520";
const got: MatchResult = {
  placements: [3, 0, 2, 4, 1],
  scores: [40.5, 3.25, 20, 99.987654321, 10].map((coverage, pid) => ({ pid, coverage })),
};
const placeOf = (slot: number) => got.placements.indexOf(slot) + 1;
const db = (): ExpectedSeat[] =>
  got.scores.map((s) => ({ slot: s.pid, name: `bot${s.pid}`, placement: placeOf(s.pid), coverage: Math.fround(s.coverage) }));
const names = ["a", "b", "c", "d", "e"];

describe("verdict", () => {
  it("verifies against the replay's own result", () => {
    expect(verdict({ shippedHash: HASH, engineHash: HASH, got, recorded: got })).toEqual({ kind: "verified" });
  });
  it("verifies against database seats stored as float4", () => {
    expect(verdict({ shippedHash: HASH, engineHash: HASH, got, recorded: null, expected: db() })).toEqual({ kind: "verified" });
  });
  it("reports a seat whose database placement differs", () => {
    const expected = db();
    expected[2] = { ...expected[2], placement: 1 };
    const v = verdict({ shippedHash: HASH, engineHash: HASH, got, recorded: got, expected });
    expect(v).toMatchObject({ kind: "mismatch", seats: [{ slot: 2, got: { place: 3 }, recorded: { place: 1 } }] });
    expect(verdictText(v, names)).toBe("Result mismatch: c placed 3rd with 20.0% here, recorded 1st with 20.0%.");
  });
  it("reports coverage outside the tolerance", () => {
    const recorded = { ...got, scores: got.scores.map((s) => (s.pid === 1 ? { ...s, coverage: s.coverage + 0.001 } : s)) };
    expect(verdict({ shippedHash: HASH, engineHash: HASH, got, recorded })).toMatchObject({ kind: "mismatch", seats: [{ slot: 1 }] });
  });
  it("labels a replay from another or unknown engine", () => {
    expect(verdict({ shippedHash: HASH, engineHash: "0123456789abcdef", got, recorded: got })).toEqual({
      kind: "older-engine", engineHash: "0123456789abcdef",
    });
    expect(verdict({ shippedHash: HASH, engineHash: null, got, recorded: got })).toEqual({ kind: "older-engine", engineHash: null });
    expect(verdict({ shippedHash: HASH, engineHash: 42, got, recorded: got })).toEqual({ kind: "older-engine", engineHash: null });
  });
  it("has nothing to check without a result line or seats", () => {
    expect(verdict({ shippedHash: HASH, engineHash: HASH, got, recorded: null })).toEqual({ kind: "unchecked" });
    expect(verdict({ shippedHash: HASH, engineHash: HASH, got, recorded: null, expected: [] })).toEqual({ kind: "unchecked" });
  });
  it("skips null database facts and never verifies on nothing", () => {
    const allNull = db().map((s) => ({ ...s, placement: null, coverage: null }));
    expect(verdict({ shippedHash: HASH, engineHash: HASH, got, recorded: null, expected: allNull })).toEqual({ kind: "unchecked" });
    const someNull = db();
    someNull[0] = { ...someNull[0], coverage: null };
    expect(verdict({ shippedHash: HASH, engineHash: HASH, got, recorded: null, expected: someNull })).toEqual({ kind: "verified" });
  });
});

describe("parseResult", () => {
  it("accepts a well-formed result line", () => {
    expect(parseResult({ scores: got.scores.map((s) => ({ ...s, deaths: 1 })), placements: got.placements })).toEqual(got);
  });
  it.each([
    ["null", null],
    ["a string", "x"],
    ["short placements", { scores: got.scores, placements: [0, 1, 2, 3] }],
    ["repeated placements", { scores: got.scores, placements: [0, 0, 1, 2, 3] }],
    ["non-integer placements", { scores: got.scores, placements: [0, 1, 2, 3, 4.5] }],
    ["a score without coverage", { scores: [...got.scores.slice(0, 4), { pid: 4 }], placements: got.placements }],
    ["a non-numeric coverage", { scores: [...got.scores.slice(0, 4), { pid: 4, coverage: "9" }], placements: got.placements }],
    ["four scores", { scores: got.scores.slice(0, 4), placements: got.placements }],
    ["repeated score pids", { scores: [{ pid: 0, coverage: 1 }, { pid: 0, coverage: 2 }, ...got.scores.slice(2)], placements: got.placements }],
  ])("rejects %s", (_, raw) => {
    expect(parseResult(raw)).toBeNull();
  });
});

describe("seatNames", () => {
  it("uses database names, with deleted bots named", () => {
    const expected = db();
    expected[1] = { ...expected[1], name: null };
    expect(seatNames(null, expected)).toEqual(["bot0", "deleted bot", "bot2", "bot3", "bot4"]);
  });
  it("uses bot_name from a replay header", () => {
    expect(seatNames([{ slot: 0, bot_name: "greedy" }, { slot: 3, bot_name: " hunter " }])).toEqual([
      "greedy", "Player 2", "Player 3", "hunter", "Player 5",
    ]);
  });
  it("falls back to Player N for anything malformed", () => {
    const players = [7, null, { slot: 9, bot_name: "x" }, { slot: "1", bot_name: "y" }, { slot: 2, bot_name: 5 }, { slot: 4, bot_name: "   " }];
    expect(seatNames(players)).toEqual(["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"]);
    expect(seatNames("nonsense")).toEqual(["Player 1", "Player 2", "Player 3", "Player 4", "Player 5"]);
  });
  it("shortens very long names", () => {
    expect(seatNames([{ slot: 0, bot_name: "x".repeat(500) }])[0]).toHaveLength(40);
  });
});

describe("verdictText", () => {
  it("says each outcome in plain words", () => {
    expect(verdictText({ kind: "verified" }, names)).toBe("Verified: the engine reproduced this result.");
    expect(verdictText({ kind: "unchecked" }, names)).toBe("No recorded result to check this replay against.");
    expect(verdictText({ kind: "older-engine", engineHash: "0123456789abcdef" }, names)).toBe(
      "Recorded on an older engine (0123456789ab…), so this result can't be verified.",
    );
    expect(verdictText({ kind: "older-engine", engineHash: null }, names)).toBe(
      "Recorded on an older engine, so this result can't be verified.",
    );
  });
});
