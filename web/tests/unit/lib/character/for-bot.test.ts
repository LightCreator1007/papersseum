import { describe, expect, it } from "vitest";
import { characterFor } from "@/lib/character/for-bot";
import { genomeFromSeed, type BotGenome } from "@/lib/character/genome";

const SAVED: BotGenome = { v: 1, head: 5, eyes: 1, antenna: 3, mouth: 3, pattern: 2, signature: 4 };

describe("characterFor", () => {
  it("draws the saved character when there is one", () => {
    expect(characterFor({ name: "ash_bot", appearance: SAVED })).toEqual(SAVED);
  });

  it("draws the name's character when nothing is saved", () => {
    expect(characterFor({ name: "ash_bot" })).toEqual(genomeFromSeed("ash_bot"));
    expect(characterFor({ name: "ash_bot", appearance: null })).toEqual(genomeFromSeed("ash_bot"));
  });

  it("falls back to the name for anything it doesn't recognise", () => {
    for (const appearance of ["{}", 3, [], { ...SAVED, v: 2 }, { ...SAVED, head: 9 }, { ...SAVED, eyes: 1.5 }, { v: 1 }]) {
      expect(characterFor({ name: "ash_bot", appearance })).toEqual(genomeFromSeed("ash_bot"));
    }
  });

  it("gives a deleted bot the shared deleted character", () => {
    expect(characterFor({ name: null, appearance: null })).toEqual(genomeFromSeed("deleted"));
  });
});
