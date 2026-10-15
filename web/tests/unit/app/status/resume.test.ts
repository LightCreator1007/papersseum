import { describe, expect, it } from "vitest";
import { resumeText, workerDown } from "@/app/status/resume";

const base = { worker: "idle" as const, skipped: null, queued: 0, running: 0 };

describe("resumeText", () => {
  it("says nothing when matches are running normally", () => {
    expect(resumeText(base)).toBeNull();
  });

  it("promises an update when the worker is paused, with no made-up time", () => {
    expect(resumeText({ ...base, worker: "paused" })).toBe("We'll post here when they're back.");
    expect(resumeText({ ...base, worker: "unknown" })).toBe("We'll post here when they're back.");
  });

  it("ties a backlog skip to the queue", () => {
    const skipped = { reason: "backlog" as const, since: "2026-10-13T09:15:00Z" };
    expect(resumeText({ ...base, skipped, queued: 58, running: 4 })).toBe(
      "They resume once the queue clears (62 matches left).",
    );
    expect(resumeText({ ...base, skipped, queued: 1, running: 0 })).toMatch(/\(1 match left\)/);
  });

  it("has no resume line for a frozen season", () => {
    expect(resumeText({ ...base, skipped: { reason: "frozen", since: "2026-10-13T09:15:00Z" } })).toBeNull();
  });
});

describe("workerDown", () => {
  it("is true only for paused or never-seen workers", () => {
    expect(workerDown({ worker: "paused" })).toBe(true);
    expect(workerDown({ worker: "unknown" })).toBe(true);
    expect(workerDown({ worker: "running" })).toBe(false);
  });
});
