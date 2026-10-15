import { describe, expect, it } from "vitest";
import {
  CONCURRENT_UPLOAD_MESSAGE,
  GENERIC_UPLOAD_ERROR,
  JUST_STARTED_MS,
  MAX_BYTES,
  NO_BOT_MESSAGE,
  NOTEBOOK_MESSAGE,
  checkFile,
  identicalMessage,
  identicalVersion,
  isUtf8,
  startedJustNow,
  uploadErrorMessage,
  waitText,
} from "@/features/upload/upload-rules";

describe("checkFile", () => {
  it("uses the same 1,000,000-byte limit as the server's scan", () => {
    expect(MAX_BYTES).toBe(1_000_000);
  });
  it("accepts a .py file up to exactly 1 MB", () => {
    expect(checkFile("agent.py", 1)).toBeNull();
    expect(checkFile("Agent.PY", MAX_BYTES)).toBeNull();
  });
  it("refuses one byte over 1 MB", () => {
    expect(checkFile("agent.py", MAX_BYTES + 1)).toBe("That file is over 1 MB.");
  });
  it("refuses an empty file", () => {
    expect(checkFile("agent.py", 0)).toBe("That file is empty.");
  });
  it("tells notebook users to export a .py file", () => {
    expect(checkFile("agent.ipynb", 10)).toBe(NOTEBOOK_MESSAGE);
    expect(checkFile("Agent.IPYNB", 0)).toBe(NOTEBOOK_MESSAGE);
    expect(NOTEBOOK_MESSAGE).toBe("Notebooks can't run here. Export it as a .py file (File, Download as, Python).");
  });
  it("refuses other extensions", () => {
    expect(checkFile("agent.txt", 10)).toBe("Choose a .py file.");
    expect(checkFile("agent.py.zip", 10)).toBe("Choose a .py file.");
  });
});

describe("isUtf8", () => {
  it("accepts source text", () => {
    expect(isUtf8(new TextEncoder().encode("class Agent:\n    pass  # é\n"))).toBe(true);
  });
  it("refuses binary data", () => {
    expect(isUtf8(new Uint8Array([0xff, 0xfe, 0x00, 0x81]))).toBe(false);
  });
});

describe("waitText", () => {
  it("reads minutes and seconds", () => {
    expect(waitText("Please wait 00:07:12 before submitting again")).toBe("7 min 12 s");
  });
  it("folds hours into minutes", () => {
    expect(waitText("Please wait 01:02:03 before submitting again")).toBe("62 min 3 s");
  });
  it("drops zero parts", () => {
    expect(waitText("Please wait 00:10:00 before submitting again")).toBe("10 min");
    expect(waitText("Please wait 00:00:09 before submitting again")).toBe("9 s");
  });
  it("returns null when there is no time", () => {
    expect(waitText("Please wait a bit")).toBeNull();
  });
});

describe("uploadErrorMessage", () => {
  it("maps the database's refusal codes", () => {
    expect(uploadErrorMessage("PS001", "Submissions are closed")).toBe("Submissions are closed for this season.");
    expect(uploadErrorMessage("PS003", "This bot is banned")).toBe("This bot is banned, so it can't take uploads. If you think that's a mistake, open an issue on GitHub.");
    expect(uploadErrorMessage("PS004", "Please wait 00:07:12 before submitting again"))
      .toBe("You can upload again in 7 min 12 s.");
  });
  it("still makes sense if the cooldown message changes", () => {
    expect(uploadErrorMessage("PS004", "slow down")).toBe("You uploaded recently. Try again in a few minutes.");
  });
  it("hides anything else behind a generic message", () => {
    expect(uploadErrorMessage("23505", 'duplicate key value violates unique constraint "x"')).toBe(GENERIC_UPLOAD_ERROR);
    expect(uploadErrorMessage(undefined, "fetch failed")).toBe(GENERIC_UPLOAD_ERROR);
  });
});

describe("uploadErrorMessage, split cases", () => {
  it("names a missing bot instead of the generic failure", () => {
    expect(uploadErrorMessage("PS002", "No bot for this user")).toBe(NO_BOT_MESSAGE);
  });
  it("tells a second tab that another upload just started", () => {
    expect(uploadErrorMessage("PS004", "Please wait 00:09:58 before submitting again", { justStarted: true })).toBe(
      CONCURRENT_UPLOAD_MESSAGE,
    );
  });
  it("keeps the cooldown copy when the last upload is not fresh", () => {
    expect(uploadErrorMessage("PS004", "Please wait 00:04:00 before submitting again", { justStarted: false })).toBe(
      "You can upload again in 4 min.",
    );
  });
});

describe("startedJustNow", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  it("is true inside the window", () => {
    expect(startedJustNow("2026-10-15T11:59:50Z", now)).toBe(true);
  });
  it("is false at or past the window", () => {
    expect(startedJustNow(new Date(now - JUST_STARTED_MS).toISOString(), now)).toBe(false);
    expect(startedJustNow("2026-10-15T11:50:00Z", now)).toBe(false);
  });
  it("is false with no or unreadable time", () => {
    expect(startedJustNow(null, now)).toBe(false);
    expect(startedJustNow(undefined, now)).toBe(false);
    expect(startedJustNow("not a date", now)).toBe(false);
  });
});

describe("identicalVersion", () => {
  it("is null with no match", () => {
    expect(identicalVersion([])).toBeNull();
  });
  it("returns the newest matching version", () => {
    expect(
      identicalVersion([
        { version: 2, status: "superseded", error: null },
        { version: 4, status: "rejected", error: "import 'os' is not allowed" },
      ]),
    ).toBe(4);
  });
  it("lets a file whose check could not run be sent again", () => {
    expect(identicalVersion([{ version: 5, status: "rejected", error: "Validation could not run: sandbox timeout" }])).toBeNull();
    expect(
      identicalVersion([
        { version: 5, status: "rejected", error: "Validation could not run: sandbox timeout" },
        { version: 3, status: "active", error: null },
      ]),
    ).toBe(3);
  });
  it("words the refusal", () => {
    expect(identicalMessage(3)).toBe("Identical to v3. Nothing uploaded, and your cooldown wasn't used.");
  });
});
