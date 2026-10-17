import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
import { devBot } from "@/lib/dev-fixtures";
import { characterFor } from "@/lib/character/for-bot";
import { genomeFromSeed, parseGenome } from "@/lib/character/genome";

describe("dev personas' characters", () => {
  it("the player has a saved character that differs from the one its name seeds", () => {
    const player = devBot("player")!;
    expect(parseGenome(player.appearance)).toEqual(player.appearance);
    expect(characterFor(player)).not.toEqual(genomeFromSeed(player.name));
  });

  it("the newcomer has none, so it wears the seeded character", () => {
    const newcomer = devBot("newcomer")!;
    expect(newcomer.appearance).toBeNull();
    expect(characterFor(newcomer)).toEqual(genomeFromSeed(newcomer.name));
  });
});
