import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { deriveArenaStatus, type StatusInput } from "@/lib/server/arena-status";

const now = new Date("2026-10-15T10:07:00Z");
const base: StatusInput = {
  lastSeenAt: "2026-10-15T10:06:30Z", queued: 0, running: 0,
  lastRoundAt: "2026-10-15T10:00:00Z", frozen: false, maxBacklog: 60, activePlayers: 12,
};

describe("deriveArenaStatus", () => {
  it("is idle with a fresh heartbeat and nothing running", () => {
    expect(deriveArenaStatus(base, now).worker).toBe("idle");
  });
  it("is running when a match job is running", () => {
    expect(deriveArenaStatus({ ...base, running: 1 }, now).worker).toBe("running");
  });
  it("is still not paused at exactly 5 minutes", () => {
    expect(deriveArenaStatus({ ...base, lastSeenAt: "2026-10-15T10:02:00Z" }, now).worker).toBe("idle");
  });
  it("is paused one second after 5 minutes", () => {
    expect(deriveArenaStatus({ ...base, lastSeenAt: "2026-10-15T10:01:59Z" }, now).worker).toBe("paused");
  });
  it("is unknown with no heartbeat ever", () => {
    expect(deriveArenaStatus({ ...base, lastSeenAt: null }, now).worker).toBe("unknown");
  });
  it("puts the next round on the next quarter hour", () => {
    expect(deriveArenaStatus(base, now).nextRoundAt).toBe("2026-10-15T10:15:00.000Z");
  });
  it("puts the next round 15 minutes on when now is exactly on a boundary", () => {
    expect(deriveArenaStatus(base, new Date("2026-10-15T10:15:00Z")).nextRoundAt).toBe("2026-10-15T10:30:00.000Z");
  });
  it("reports no skip inside the grace window", () => {
    expect(deriveArenaStatus(base, new Date("2026-10-15T10:17:00Z")).skipped).toBeNull();
  });
  it("reports a frozen skip once past the grace window", () => {
    const s = deriveArenaStatus({ ...base, frozen: true }, new Date("2026-10-15T10:17:01Z"));
    expect(s.skipped).toEqual({ reason: "frozen", since: "2026-10-15T10:15:00.000Z" });
  });
  it("reports a backlog skip when pending matches reach the limit", () => {
    const s = deriveArenaStatus({ ...base, queued: 60 }, new Date("2026-10-15T10:20:00Z"));
    expect(s.skipped?.reason).toBe("backlog");
  });
  it("counts running match jobs toward the backlog, like schedule_round", () => {
    const s = deriveArenaStatus({ ...base, queued: 59, running: 1 }, new Date("2026-10-15T10:20:00Z"));
    expect(s.skipped?.reason).toBe("backlog");
  });
  it("is not a backlog skip one job under the limit", () => {
    const s = deriveArenaStatus({ ...base, queued: 58, running: 1 }, new Date("2026-10-15T10:20:00Z"));
    expect(s.skipped?.reason).toBe("unknown");
  });
  it("reports no players when nobody has an active bot", () => {
    const s = deriveArenaStatus({ ...base, activePlayers: 0 }, new Date("2026-10-15T10:20:00Z"));
    expect(s.skipped?.reason).toBe("no-players");
  });
  it("says unknown when none of the known reasons apply", () => {
    expect(deriveArenaStatus(base, new Date("2026-10-15T10:40:00Z")).skipped?.reason).toBe("unknown");
  });
  it("has no skip when there has never been a round", () => {
    expect(deriveArenaStatus({ ...base, lastRoundAt: null }, now).skipped).toBeNull();
  });
  it("returns exactly the public keys", () => {
    expect(Object.keys(deriveArenaStatus(base, now)).sort()).toEqual(
      ["checkedAt", "lastRoundAt", "lastSeenAt", "nextRoundAt", "queued", "running", "skipped", "worker"],
    );
  });
});
