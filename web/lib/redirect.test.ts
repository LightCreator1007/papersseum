import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/leaderboard")).toBe("/leaderboard");
    expect(safeNext("/matches/12?x=1")).toBe("/matches/12?x=1");
    expect(safeNext("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com"); // stays a path on our origin
  });
  it.each([
    [null], [undefined], [""], ["leaderboard"], ["https://evil.com"], ["//evil.com"],
    ["/\\evil.com"], ["/\t/evil.com"], ["/\n/evil.com"], ["\\\\evil.com"],
  ])("sends %j to the fallback", (value) => {
    expect(safeNext(value)).toBe("/me");
  });
  it("uses a custom fallback", () => {
    expect(safeNext("//evil.com", "/")).toBe("/");
  });
});
