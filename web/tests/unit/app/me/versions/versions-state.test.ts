import { describe, expect, it } from "vitest";
import { capNote, hasChecking } from "@/app/me/versions/versions-state";

describe("hasChecking", () => {
  it("is true while any version is pending or validating", () => {
    expect(hasChecking([{ status: "active" }, { status: "pending" }])).toBe(true);
    expect(hasChecking([{ status: "validating" }])).toBe(true);
  });

  it("is false when every version is settled, or there are none", () => {
    expect(hasChecking([{ status: "active" }, { status: "rejected" }, { status: "superseded" }])).toBe(false);
    expect(hasChecking([])).toBe(false);
  });
});

describe("capNote", () => {
  it("says the list is cut only when the cap is reached", () => {
    expect(capNote(49, 50)).toBeNull();
    expect(capNote(50, 50)).toBe("Showing the latest 50.");
    expect(capNote(0, 50)).toBeNull();
  });
});
