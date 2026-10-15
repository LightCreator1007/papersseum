import { describe, expect, it } from "vitest";
import { nextLiveState, reconnectingText, shouldCatchUp, shouldPoll } from "@/components/live-refresh-state";

describe("nextLiveState", () => {
  it("goes live on SUBSCRIBED from any state", () => {
    for (const s of ["connecting", "live", "reconnecting"] as const) expect(nextLiveState(s, "SUBSCRIBED")).toBe("live");
  });

  it("reconnects on an error, a timeout or a closed channel", () => {
    for (const e of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"] as const) {
      expect(nextLiveState("live", e)).toBe("reconnecting");
      expect(nextLiveState("connecting", e)).toBe("reconnecting");
    }
  });

  it("gives up waiting for the first join after the grace period, and only then", () => {
    expect(nextLiveState("connecting", "grace-expired")).toBe("reconnecting");
    expect(nextLiveState("live", "grace-expired")).toBe("live");
    expect(nextLiveState("reconnecting", "grace-expired")).toBe("reconnecting");
  });
});

describe("polling and catch-up", () => {
  it("polls whenever the channel isn't joined", () => {
    expect(shouldPoll("connecting")).toBe(true);
    expect(shouldPoll("reconnecting")).toBe(true);
    expect(shouldPoll("live")).toBe(false);
  });

  it("refreshes once when the channel comes back, not on the first join", () => {
    expect(shouldCatchUp("reconnecting", "live")).toBe(true);
    expect(shouldCatchUp("connecting", "live")).toBe(false);
    expect(shouldCatchUp("live", "reconnecting")).toBe(false);
  });

  it("says offline when the browser is offline", () => {
    expect(reconnectingText(true)).toMatch(/^Reconnecting/);
    expect(reconnectingText(false)).toMatch(/^Offline/);
  });
});
