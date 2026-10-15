import { describe, expect, it } from "vitest";
import { countdown, seasonPhase, type SeasonDates } from "@/lib/season-phase";

const d: SeasonDates = {
  opensAt: "2026-11-01T00:00:00Z", closesAt: "2026-11-30T18:00:00Z", finalAt: "2026-12-01T12:00:00Z", frozen: false,
};
const at = (s: string) => new Date(s);

describe("seasonPhase", () => {
  it("is unscheduled with no dates", () => {
    expect(seasonPhase({ opensAt: null, closesAt: null, finalAt: null, frozen: false }, at("2026-10-15T00:00:00Z")))
      .toEqual({ phase: "unscheduled", target: null });
  });
  it("is frozen with no dates when the flag is set", () => {
    expect(seasonPhase({ opensAt: null, closesAt: null, finalAt: null, frozen: true }, at("2026-10-15T00:00:00Z")).phase).toBe("frozen");
  });
  it("is upcoming before it opens", () => {
    expect(seasonPhase(d, at("2026-10-31T23:59:59Z"))).toEqual({ phase: "upcoming", target: d.opensAt });
  });
  it("is open at the opening instant", () => {
    expect(seasonPhase(d, at("2026-11-01T00:00:00Z"))).toEqual({ phase: "open", target: d.closesAt });
  });
  it("is closing soon in the last 24 hours", () => {
    expect(seasonPhase(d, at("2026-11-29T18:00:00Z")).phase).toBe("closing-soon");
  });
  it("is frozen between close and final, counting to the final", () => {
    expect(seasonPhase(d, at("2026-11-30T18:00:00Z"))).toEqual({ phase: "frozen", target: d.finalAt });
  });
  it("is final for 24 hours from the final", () => {
    expect(seasonPhase(d, at("2026-12-01T12:00:00Z")).phase).toBe("final");
  });
  it("is over afterwards", () => {
    expect(seasonPhase(d, at("2026-12-02T12:00:01Z"))).toEqual({ phase: "over", target: null });
  });
  it("treats the frozen flag as frozen even mid-season", () => {
    expect(seasonPhase({ ...d, frozen: true }, at("2026-11-10T00:00:00Z")).phase).toBe("frozen");
  });
});

describe("countdown", () => {
  it("splits the remaining time", () => {
    expect(countdown("2026-11-02T03:04:05Z", at("2026-11-01T00:00:00Z")))
      .toEqual({ days: 1, hours: 3, minutes: 4, seconds: 5, done: false });
  });
  it("never goes negative", () => {
    expect(countdown("2026-11-01T00:00:00Z", at("2026-11-01T00:00:01Z")))
      .toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, done: true });
  });
});
