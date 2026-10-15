import { describe, expect, it } from "vitest";
import { firstRow } from "@/features/upload/first-row";
import { SHORT_QUEUE, inLine, waitLine } from "@/features/upload/progress-copy";
import { fixHints, replacedBy } from "@/features/upload/version-notes";

describe("firstRow", () => {
  it("takes the first row of a returns-table array", () => {
    expect(firstRow([{ name: "neo" }, { name: "other" }])).toEqual({ name: "neo" });
  });
  it("passes a single object through", () => {
    expect(firstRow({ name: "neo" })).toEqual({ name: "neo" });
  });
  it("is null for an empty array, null or undefined", () => {
    expect(firstRow([])).toBeNull();
    expect(firstRow(null)).toBeNull();
    expect(firstRow(undefined)).toBeNull();
  });
});

describe("waitLine", () => {
  const base = { stage: "queued" as const, paused: false, stuck: false };
  it("promises a few minutes only for a short queue", () => {
    expect(waitLine({ ...base, ahead: 0 })).toMatch(/^Usually a few minutes\./);
    expect(waitLine({ ...base, ahead: SHORT_QUEUE - 1 })).toMatch(/^Usually a few minutes\./);
  });
  it("states the number ahead for a long queue", () => {
    expect(waitLine({ ...base, ahead: SHORT_QUEUE })).toBe(`${SHORT_QUEUE} uploads ahead of yours. This page updates on its own.`);
    expect(waitLine({ ...base, ahead: 12 })).toMatch(/^12 uploads ahead of yours\./);
  });
  it("promises nothing when the queue couldn't be read", () => {
    expect(waitLine({ ...base, ahead: null })).not.toMatch(/few minutes/);
  });
  it("says a few minutes once checking", () => {
    expect(waitLine({ ...base, stage: "checking", ahead: null })).toMatch(/^Usually a few minutes\./);
  });
  it("drops the promise when paused or stuck", () => {
    expect(waitLine({ ...base, ahead: 0, paused: true })).toBe("This page updates on its own.");
    expect(waitLine({ ...base, stage: "checking", ahead: null, stuck: true })).toBe("This page updates on its own.");
  });
});

describe("inLine", () => {
  it("words the queue position", () => {
    expect(inLine(0)).toBe("Next in line");
    expect(inLine(4)).toBe("4 ahead of you");
    expect(inLine(null)).toBe("Waiting");
  });
});

describe("replacedBy", () => {
  const subs = [
    { version: 5, status: "validating" },
    { version: 4, status: "rejected" },
    { version: 3, status: "active" },
    { version: 2, status: "superseded" },
    { version: 1, status: "superseded" },
  ];
  it("names the next later version that passed", () => {
    expect(replacedBy(subs, subs[3], 3)).toBe(3);
    expect(replacedBy(subs, subs[4], 3)).toBe(2);
  });
  it("skips rejected and still-checking versions", () => {
    const s = [{ version: 3, status: "rejected" }, { version: 2, status: "active" }, { version: 1, status: "superseded" }];
    expect(replacedBy(s, s[2], 2)).toBe(2);
  });
  it("falls back to the active version after a rollback", () => {
    const s = [{ version: 3, status: "superseded" }, { version: 2, status: "active" }];
    expect(replacedBy(s, s[0], 2)).toBe(2);
  });
  it("is null when nothing names a replacement", () => {
    const s = [{ version: 2, status: "superseded" }];
    expect(replacedBy(s, s[0], null)).toBeNull();
    expect(replacedBy(s, s[0], 2)).toBeNull();
  });
});

describe("fixHints", () => {
  it("gives one hint per kind, in order of first appearance", () => {
    const hints = fixHints(
      [
        { kind: "import" },
        { kind: "call" },
        { kind: "import" },
      ],
      null,
    );
    expect(hints).toHaveLength(2);
    expect(hints[0]).toMatch(/^Remove the import\./);
    expect(hints[1]).toMatch(/^Remove the call\./);
  });
  it("covers every kind the static check emits", () => {
    for (const kind of ["syntax", "import", "call", "attr", "name", "weights", "size"]) {
      expect(fixHints([{ kind }], null)).toHaveLength(1);
    }
  });
  it("ignores unknown kinds", () => {
    expect(fixHints([{ kind: "mystery" }, { kind: "" }], null)).toEqual([]);
  });
  it("maps a missing Agent class from the error text", () => {
    expect(fixHints([], "must define a class named 'Agent'")).toEqual(["Define a class named Agent in the file."]);
  });
  it("has no dashes in any hint", () => {
    const all = fixHints(["syntax", "import", "call", "attr", "name", "weights", "size"].map((kind) => ({ kind })), "class named Agent");
    for (const h of all) expect(h).not.toMatch(new RegExp(String.fromCharCode(0x5b, 0x2013, 0x2014, 0x5d)));
  });
});
