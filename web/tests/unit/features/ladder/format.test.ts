import { describe, expect, it } from "vitest";
import {
  MATCH_STATUS, SUBMISSION_STATUS, clockTime, duration, elo, eloChange, intervalMinutes,
  minutesUntil, nextRoundAt, nextRoundSentence, percent, rating, relativeTime, shortDate, shortDateTime,
} from "@/features/ladder/format";

const NOW = Date.parse("2026-10-13T09:00:00Z"); // 14:30 in Kolkata

describe("relativeTime", () => {
  it("says just now under a minute", () => {
    expect(relativeTime("2026-10-13T08:59:30Z", NOW)).toBe("just now");
  });
  it("counts minutes under an hour", () => {
    expect(relativeTime("2026-10-13T08:56:00Z", NOW)).toBe("4 min ago");
  });
  it("counts hours under a day", () => {
    expect(relativeTime("2026-10-13T06:00:00Z", NOW)).toBe("3 h ago");
  });
  it("falls back to a date after a day", () => {
    expect(relativeTime("2026-10-07T12:00:00Z", NOW)).toBe("7 Oct");
  });
});

describe("dates in Kolkata time", () => {
  it("formats a short date", () => {
    expect(shortDate("2026-10-06T20:00:00Z")).toBe("7 Oct"); // 01:30 on the 7th in IST
  });
  it("formats a date and time", () => {
    expect(shortDateTime("2026-10-07T12:32:00Z")).toBe("7 Oct, 18:02 IST");
  });
  it("formats a clock time", () => {
    expect(clockTime(Date.parse("2026-10-13T09:15:00Z"))).toBe("14:45 IST");
  });
});

describe("duration", () => {
  it("shows minutes and seconds", () => {
    expect(duration("2026-10-13T09:00:00Z", "2026-10-13T09:01:41Z")).toBe("1 min 41 s");
  });
  it("shows only seconds under a minute", () => {
    expect(duration("2026-10-13T09:00:00Z", "2026-10-13T09:00:42Z")).toBe("42 s");
  });
});

describe("numbers", () => {
  it("formats Elo with one decimal", () => {
    expect(elo(1342.64)).toBe("1342.6");
    expect(elo(null)).toBe("-");
  });
  it("formats an Elo gain, loss and no change", () => {
    expect(eloChange(1330.1, 1342.6)).toEqual({ text: "+12.5", tone: "up" });
    expect(eloChange(1303.0, 1298.1)).toEqual({ text: "−4.9", tone: "down" });
    expect(eloChange(1000, 1000)).toEqual({ text: "0.0", tone: "none" });
  });
  it("returns null when either side is missing", () => {
    expect(eloChange(null, 1000)).toBeNull();
    expect(eloChange(1000, null)).toBeNull();
  });
  it("formats coverage as a percentage", () => {
    expect(percent(31.42)).toBe("31.4%");
    expect(percent(null)).toBe("-");
  });
});

describe("rating", () => {
  it("says not rated yet for a bot with no games", () => {
    expect(rating(1000, 0)).toBe("Not rated yet");
    expect(rating(null, 0)).toBe("Not rated yet");
  });
  it("shows the number once a bot has played", () => {
    expect(rating(412.34, 3)).toBe("412.3");
  });
});

describe("no dashes", () => {
  it("never renders an em or en dash", () => {
    expect(elo(null) + percent(null)).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`));
  });
});

describe("intervalMinutes", () => {
  it("reads a Postgres interval", () => {
    expect(intervalMinutes("00:10:00")).toBe(10);
    expect(intervalMinutes("01:30:00")).toBe(90);
  });
  it("returns 0 for anything else", () => {
    expect(intervalMinutes("10 minutes")).toBe(0);
  });
});

describe("next round", () => {
  it("is the next quarter hour", () => {
    expect(nextRoundAt(Date.parse("2026-10-13T09:07:30Z"))).toBe(Date.parse("2026-10-13T09:15:00Z"));
  });
  it("moves on when exactly on a boundary", () => {
    expect(nextRoundAt(Date.parse("2026-10-13T09:15:00Z"))).toBe(Date.parse("2026-10-13T09:30:00Z"));
  });
  it("rounds minutes up and never says 0", () => {
    const now = Date.parse("2026-10-13T09:14:50Z");
    expect(minutesUntil(nextRoundAt(now), now)).toBe(1);
    expect(minutesUntil(Date.parse("2026-10-13T09:15:00Z"), Date.parse("2026-10-13T09:08:10Z"))).toBe(7);
  });
});

describe("nextRoundSentence", () => {
  const at = Date.parse("2026-10-13T16:00:00Z"); // 21:30 in Kolkata
  const base = { frozen: false, backlog: false, at };
  it("gives the clock time in IST", () => {
    expect(nextRoundSentence(base)).toBe("Next round at 21:30 IST.");
    expect(nextRoundSentence(base, { first: true })).toBe("The first round runs at 21:30 IST.");
  });
  it("doesn't promise a time while rounds are skipped for the backlog", () => {
    expect(nextRoundSentence({ ...base, backlog: true })).toBe("Next round after the queue clears.");
  });
  it("says frozen before anything else", () => {
    expect(nextRoundSentence({ ...base, frozen: true, backlog: true })).toMatch(/frozen/);
  });
  it("waits for a player when nobody has a bot", () => {
    expect(nextRoundSentence({ ...base, noPlayers: true })).toMatch(/once a player/);
  });
});

describe("status wording", () => {
  it("uses plain words", () => {
    expect(SUBMISSION_STATUS.validating).toBe("Checking…");
    expect(SUBMISSION_STATUS.superseded).toBe("Replaced");
    expect(MATCH_STATUS.queued).toBe("Waiting");
    expect(MATCH_STATUS.done).toBe("Finished");
  });
});
