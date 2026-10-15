import { describe, expect, it } from "vitest";
import { validateBotName } from "@/lib/bot-name";

describe("validateBotName", () => {
  it("lowercases and trims", () => {
    expect(validateBotName("  Neo_Bot ")).toEqual({ ok: true, name: "neo_bot" });
  });
  it.each(["a", "x".repeat(33), "has space", "dash-name", "emoji😀", "ünï"])("rejects %s", (raw) => {
    expect(validateBotName(raw).ok).toBe(false);
  });
  it("accepts 2 and 32 characters", () => {
    expect(validateBotName("ab").ok).toBe(true);
    expect(validateBotName("a".repeat(32)).ok).toBe(true);
  });
  it.each(["admin", "greedy", "safe_expander", "hunter", "random", "me", "new", "house_random", "house_greedy_1"])("reserves %s", (raw) => {
    expect(validateBotName(raw)).toEqual({ ok: false, message: "That name is reserved. Pick another." });
  });
});
