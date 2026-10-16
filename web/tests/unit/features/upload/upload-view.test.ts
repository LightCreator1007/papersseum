import { describe, expect, it } from "vitest";
import { cooldownLeft, countdown, uploadView } from "@/features/upload/upload-view";

const T = "2026-10-15T12:00:00.000Z";
const sub = (version: number, status: string, createdAt = T) => ({ version, status, createdAt });
const open = { banned: false, frozen: false, cooldownMinutes: 15 };

describe("uploadView", () => {
  it("starts at v1 with nothing to wait out", () => {
    expect(uploadView([], open)).toEqual({ next: 1, checking: null, rejected: null, nextUploadAt: null, closed: null });
  });

  it("numbers the next upload past the highest version, in any order", () => {
    expect(uploadView([sub(2, "superseded"), sub(5, "active"), sub(3, "rejected")], open).next).toBe(6);
  });

  it("only the newest upload counts as checking or rejected", () => {
    const checking = uploadView([sub(5, "validating"), sub(4, "rejected")], open);
    expect(checking.checking?.version).toBe(5);
    expect(checking.rejected).toBeNull();
    const rejected = uploadView([sub(4, "rejected"), sub(3, "active")], open);
    expect(rejected.rejected?.version).toBe(4);
    expect(rejected.checking).toBeNull();
    expect(uploadView([sub(2, "pending")], open).checking?.version).toBe(2);
  });

  it("ends the cooldown at the newest upload plus the season's minutes", () => {
    expect(uploadView([sub(1, "active")], open).nextUploadAt).toBe("2026-10-15T12:15:00.000Z");
    expect(uploadView([sub(1, "active")], { ...open, cooldownMinutes: 0 }).nextUploadAt).toBeNull();
    expect(uploadView([sub(1, "active", "not a date")], open).nextUploadAt).toBeNull();
  });

  it("names why uploads are closed, banned first", () => {
    expect(uploadView([], { ...open, banned: true, frozen: true }).closed).toBe("banned");
    expect(uploadView([], { ...open, frozen: true }).closed).toBe("frozen");
  });
});

describe("cooldownLeft and countdown", () => {
  const at = Date.parse("2026-10-15T12:15:00.000Z");
  it("counts down to zero and never below", () => {
    expect(cooldownLeft("2026-10-15T12:15:00.000Z", at - 65_000)).toBe(65_000);
    expect(cooldownLeft("2026-10-15T12:15:00.000Z", at + 1)).toBe(0);
    expect(cooldownLeft(null, at)).toBe(0);
  });
  it("reads m:ss under an hour and rounds up", () => {
    expect(countdown(65_000)).toBe("1:05");
    expect(countdown(400)).toBe("0:01");
    expect(countdown(0)).toBe("0:00");
    expect(countdown(3_900_000)).toBe("1 h 5 min");
  });
});
