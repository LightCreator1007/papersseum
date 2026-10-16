import { describe, expect, it } from "vitest";
import { describeNotification, type Notification } from "@/lib/notifications";

const n = (kind: string, payload: Record<string, unknown>): Notification =>
  ({ id: 1, kind: kind as Notification["kind"], payload, createdAt: "2026-10-15T10:00:00Z", readAt: null });

describe("describeNotification", () => {
  it("describes a pass", () => {
    expect(describeNotification(n("submission_passed", { version: 3 }))).toEqual({
      title: "Version 3 passed", body: "It plays from the next round.", href: "/me",
    });
  });
  it("quotes the rejection reason", () => {
    expect(describeNotification(n("submission_rejected", { version: 2, error: "agent is too slow" }))).toEqual({
      title: "Version 2 was rejected", body: "agent is too slow", href: "/me/versions#v2",
    });
  });
  it("links the first match", () => {
    expect(describeNotification(n("first_match", { match_id: 88, placement: 2 }))).toEqual({
      title: "Your first match is in", body: "You finished 2nd of 5.", href: "/matches/88",
    });
  });
  it("describes final results", () => {
    expect(describeNotification(n("final_results", { rank: 11 })).title).toBe("Final standings are out: you placed 11th");
  });
  it("falls back for a missing field", () => {
    expect(describeNotification(n("first_match", {}))).toEqual({ title: "Your first match is in", body: "Open it to see how it went.", href: "/matches" });
  });
  it("falls back for an unknown kind", () => {
    expect(describeNotification(n("something_new", {}))).toEqual({ title: "Update", body: "Something changed on your bot.", href: "/me" });
  });
  it("falls back for a missing version", () => {
    expect(describeNotification(n("submission_passed", {})).title).toBe("Your upload passed");
  });
  it.each([[1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [11, "11th"], [12, "12th"], [13, "13th"], [21, "21st"], [22, "22nd"], [111, "111th"]])(
    "ordinal %i is %s", (rank, text) => {
      expect(describeNotification(n("final_results", { rank })).title).toBe(`Final standings are out: you placed ${text}`);
    },
  );
});
