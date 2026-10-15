export type BotGenome = {
  v: 1;
  head: 0 | 1 | 2 | 3 | 4 | 5;
  eyes: 0 | 1 | 2 | 3 | 4 | 5;
  antenna: 0 | 1 | 2 | 3 | 4;
  mouth: 0 | 1 | 2 | 3;
  pattern: 0 | 1 | 2 | 3;
  signature: 0 | 1 | 2 | 3 | 4;
};

export type GenomePart = Exclude<keyof BotGenome, "v">;

export type Cell = { x: number; y: number; part: "body" | "eye" | "antenna" | "mouth" | "accent" };

export const DELETED_SEED = "deleted";

export const PART_COUNTS = {
  head: 6,
  eyes: 6,
  antenna: 5,
  mouth: 4,
  pattern: 4,
  signature: 5,
} as const satisfies Record<GenomePart, number>;

export const PART_NAMES = {
  head: ["square", "round", "tall", "wide", "notched", "dome"],
  eyes: ["dots", "visor", "cyclops", "wide", "sleepy", "chevron"],
  antenna: ["none", "stalk", "twin", "dish", "spike"],
  mouth: ["none", "line", "grille", "grin"],
  pattern: ["solid", "stripe", "checker", "plus"],
  signature: ["slot 1", "slot 2", "slot 3", "slot 4", "slot 5"],
} as const satisfies Record<GenomePart, readonly string[]>;

const PARTS = ["head", "eyes", "antenna", "mouth", "pattern", "signature"] as const satisfies readonly GenomePart[];

function fnv1a(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  let s = a >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function genomeFromSeed(seed: string): BotGenome {
  const rng = mulberry32(fnv1a(seed));
  const draw = (count: number) => Math.floor(rng() * count);
  return {
    v: 1,
    head: draw(PART_COUNTS.head) as BotGenome["head"],
    eyes: draw(PART_COUNTS.eyes) as BotGenome["eyes"],
    antenna: draw(PART_COUNTS.antenna) as BotGenome["antenna"],
    mouth: draw(PART_COUNTS.mouth) as BotGenome["mouth"],
    pattern: draw(PART_COUNTS.pattern) as BotGenome["pattern"],
    signature: draw(PART_COUNTS.signature) as BotGenome["signature"],
  };
}

function inRange(value: unknown, count: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < count;
}

export function parseGenome(json: unknown): BotGenome | null {
  if (typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  if (o.v !== 1) return null;
  for (const k of PARTS) if (!inRange(o[k], PART_COUNTS[k])) return null;
  return {
    v: 1,
    head: o.head as BotGenome["head"],
    eyes: o.eyes as BotGenome["eyes"],
    antenna: o.antenna as BotGenome["antenna"],
    mouth: o.mouth as BotGenome["mouth"],
    pattern: o.pattern as BotGenome["pattern"],
    signature: o.signature as BotGenome["signature"],
  };
}

export function serializeGenome(g: BotGenome): string {
  return JSON.stringify({
    v: g.v, head: g.head, eyes: g.eyes, antenna: g.antenna,
    mouth: g.mouth, pattern: g.pattern, signature: g.signature,
  });
}
