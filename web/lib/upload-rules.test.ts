import { describe, expect, it } from "vitest";
import { GENERIC_UPLOAD_ERROR, MAX_BYTES, checkFile, isUtf8, uploadErrorMessage, waitText } from "@/lib/upload-rules";

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
    expect(uploadErrorMessage("PS003", "This bot is banned")).toBe("This bot is banned. Contact the organisers.");
    expect(uploadErrorMessage("PS004", "Please wait 00:07:12 before submitting again"))
      .toBe("You can upload again in 7 min 12 s.");
  });
  it("still makes sense if the cooldown message changes", () => {
    expect(uploadErrorMessage("PS004", "slow down")).toBe("You uploaded recently. Try again in a few minutes.");
  });
  it("hides anything else behind a generic message", () => {
    expect(uploadErrorMessage("PS002", "No bot for this user")).toBe(GENERIC_UPLOAD_ERROR);
    expect(uploadErrorMessage("23505", 'duplicate key value violates unique constraint "x"')).toBe(GENERIC_UPLOAD_ERROR);
    expect(uploadErrorMessage(undefined, "fetch failed")).toBe(GENERIC_UPLOAD_ERROR);
  });
});
