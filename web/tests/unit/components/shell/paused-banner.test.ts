import { describe, expect, it } from "vitest";
import { bannerFor } from "@/components/shell/paused-banner";

describe("paused banner", () => {
  it("shows only when the worker is paused", () => {
    expect(bannerFor({ worker: "paused" })).toMatch(/Matches are paused/);
    expect(bannerFor({ worker: "idle" })).toBeNull();
    expect(bannerFor({ worker: "running" })).toBeNull();
    expect(bannerFor({ worker: "unknown" })).toBeNull();
    expect(bannerFor(null)).toBeNull();
  });
});
