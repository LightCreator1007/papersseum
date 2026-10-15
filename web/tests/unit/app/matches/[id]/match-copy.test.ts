import { describe, expect, it } from "vitest";
import { bannedNote, failureReason, versionLabel } from "@/app/matches/[id]/match-copy";

describe("failureReason", () => {
  it("says no reason was recorded for null, empty or blank errors", () => {
    for (const e of [null, undefined, "", "   "]) {
      expect(failureReason(e)).toEqual({ summary: "No reason was recorded.", raw: null });
    }
  });

  it("explains a worker that stopped responding", () => {
    const r = failureReason("Worker stopped responding");
    expect(r.summary).toMatch(/stopped responding/);
    expect(r.raw).toBe("Worker stopped responding");
  });

  it("maps known worker exceptions to plain words", () => {
    expect(failureReason("SandboxMissing: could not run docker: boom").summary).toMatch(/sandbox/);
    expect(failureReason("RuntimeError: downloaded file does not match its sha256: x.py").summary).toMatch(/downloaded intact/);
    expect(failureReason("OperationalError: server closed the connection").summary).toMatch(/database/);
  });

  it("falls back to a generic sentence and keeps the raw text", () => {
    const r = failureReason("  KeyError: 'slot'  ");
    expect(r.summary).toBe("The match server hit an error it couldn't recover from.");
    expect(r.raw).toBe("KeyError: 'slot'");
  });
});

describe("bannedNote", () => {
  it("is null for a bot that isn't banned", () => {
    expect(bannedNote("queued", false)).toBeNull();
  });

  it("says a waiting bot was banned after the draw", () => {
    expect(bannedNote("queued", true)).toBe("Banned after this match was drawn.");
    expect(bannedNote("running", true)).toBe("Banned after this match was drawn.");
  });

  it("says a played bot has been banned since", () => {
    expect(bannedNote("done", true)).toBe("Banned since this match.");
    expect(bannedNote("failed", true)).toBe("Banned since this match.");
  });
});

describe("versionLabel", () => {
  it("prints vN, or nothing when unknown", () => {
    expect(versionLabel(3)).toBe("v3");
    expect(versionLabel(null)).toBeNull();
  });
});
