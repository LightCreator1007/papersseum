import { genomeFromSeed, parseGenome, type BotGenome } from "./genome";

// A bot's character: its saved appearance when it has one, otherwise the one
// its name seeds. Deleted bots all share the "deleted" seed.
export function characterFor(bot: { name: string | null; appearance?: unknown }): BotGenome {
  return parseGenome(bot.appearance) ?? genomeFromSeed(bot.name ?? "deleted");
}

export function signatureColor(g: BotGenome): string {
  return `var(--slot-${g.signature})`;
}
