import { describe, expect, it } from "vitest";
import {
  DELETED_SEED, PART_COUNTS, PART_NAMES, genomeFromSeed, parseGenome, serializeGenome,
} from "@/lib/character/genome";
import { compose as composeCells } from "@/lib/character/compose";

const names = ["a", "snake_eater", "Ω-bot", "🤖🤖", "x".repeat(40), "house_hunter", "house_random", ""];

const cellKey = (cells: ReturnType<typeof composeCells>) =>
  cells.map((c) => `${c.x},${c.y},${c.part}`).sort().join(";");

function figureProblems(cells: ReturnType<typeof composeCells>): string[] {
  const out: string[] = [];
  const key = (x: number, y: number) => `${x},${y}`;
  const base = new Set<string>();
  const antenna = new Set<string>();
  const face = new Set<string>();
  for (const d of cells) {
    if (d.x < 0 || d.x > 11 || d.y < 0 || d.y > 11 || !Number.isInteger(d.x) || !Number.isInteger(d.y)) {
      out.push(`out of bounds ${d.part} ${key(d.x, d.y)}`);
    }
    const layer = d.part === "body" || d.part === "accent" ? base : d.part === "antenna" ? antenna : face;
    if (layer.has(key(d.x, d.y))) out.push(`duplicate ${d.part} ${key(d.x, d.y)}`);
    layer.add(key(d.x, d.y));
    if (!cells.some((m) => m.x === 11 - d.x && m.y === d.y && m.part === d.part)) {
      out.push(`unmirrored ${d.part} ${key(d.x, d.y)}`);
    }
  }
  for (const d of cells) {
    if (d.part === "antenna") {
      if (d.y > 2) out.push(`antenna below row 2 at ${key(d.x, d.y)}`);
      if (base.has(key(d.x, d.y))) out.push(`antenna overlaps head at ${key(d.x, d.y)}`);
    } else if (d.y < 3) {
      out.push(`${d.part} above row 3 at ${key(d.x, d.y)}`);
    }
    if (d.part === "eye" || d.part === "mouth") {
      const ring = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
      if (!ring.every(([dx, dy]) => base.has(key(d.x + dx, d.y + dy)))) {
        out.push(`${d.part} not enclosed by the head at ${key(d.x, d.y)}`);
      }
    }
  }
  const eyes = cells.filter((d) => d.part === "eye");
  const mouth = cells.filter((d) => d.part === "mouth");
  if (eyes.length === 0) out.push("no eyes");
  if (eyes.some((e) => mouth.some((m) => m.x === e.x && m.y === e.y))) out.push("eye overlaps mouth");
  if (mouth.some((m) => eyes.some((e) => Math.abs(m.x - e.x) <= 1 && Math.abs(m.y - e.y) <= 1))) {
    out.push("mouth touches an eye");
  }
  const reached = new Set<string>();
  const queue = cells.filter((d) => d.part === "antenna" && base.has(key(d.x, d.y + 1))).map((d) => [d.x, d.y]);
  while (queue.length > 0) {
    const [x, y] = queue.pop() ?? [0, 0];
    if (reached.has(key(x, y))) continue;
    reached.add(key(x, y));
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        if (antenna.has(key(x + dx, y + dy))) queue.push([x + dx, y + dy]);
  }
  for (const k of antenna) if (!reached.has(k)) out.push(`antenna cell ${k} floats free of the head`);
  return out;
}

describe("character genome", () => {
  it("is deterministic per seed", () => {
    for (const n of names) expect(genomeFromSeed(n)).toEqual(genomeFromSeed(n));
  });
  it("spreads across 200 seeds (at least 150 distinct silhouettes)", () => {
    const set = new Set(Array.from({ length: 200 }, (_, i) => serializeGenome(genomeFromSeed(`bot${i}`))));
    expect(set.size).toBeGreaterThanOrEqual(150);
  });
  it("round-trips and rejects out-of-range input", () => {
    const g = genomeFromSeed("roundtrip");
    expect(parseGenome(JSON.parse(serializeGenome(g)))).toEqual(g);
    expect(parseGenome({ ...g, head: 9 })).toBeNull();
    expect(parseGenome("nope")).toBeNull();
    expect(parseGenome(null)).toBeNull();
  });
  it("rejects wrong version, fractions, negatives and missing fields", () => {
    const g = genomeFromSeed("strict");
    expect(parseGenome({ ...g, v: 2 })).toBeNull();
    expect(parseGenome({ ...g, eyes: 1.5 })).toBeNull();
    expect(parseGenome({ ...g, mouth: -1 })).toBeNull();
    expect(parseGenome({ ...g, signature: "1" })).toBeNull();
    const partial: Record<string, unknown> = { ...g };
    delete partial.antenna;
    expect(parseGenome(partial)).toBeNull();
  });
  it("draws every field within its part count", () => {
    for (let i = 0; i < 200; i++) {
      const g = genomeFromSeed(`range${i}`);
      for (const k of Object.keys(PART_COUNTS) as (keyof typeof PART_COUNTS)[]) {
        expect(g[k]).toBeGreaterThanOrEqual(0);
        expect(g[k]).toBeLessThan(PART_COUNTS[k]);
      }
    }
  });
  it("names every part option", () => {
    for (const k of Object.keys(PART_COUNTS) as (keyof typeof PART_COUNTS)[]) {
      expect(PART_NAMES[k]).toHaveLength(PART_COUNTS[k]);
    }
  });
  it("gives the deleted seed a stable genome", () => {
    expect(DELETED_SEED).toBe("deleted");
    expect(genomeFromSeed(DELETED_SEED)).toEqual(genomeFromSeed("deleted"));
  });
  it("composes a mirrored 12x12 figure with eyes", () => {
    const cells = composeCells(genomeFromSeed("mirror"));
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.x).toBeLessThan(12);
      expect(c.y).toBeGreaterThanOrEqual(0); expect(c.y).toBeLessThan(12);
      expect(cells.some((d) => d.x === 11 - c.x && d.y === c.y)).toBe(true);
    }
    expect(cells.some((c) => c.part === "eye")).toBe(true);
  });
  it("composes every combination into a well-formed layered figure", () => {
    const c = PART_COUNTS;
    const problems: string[] = [];
    for (let head = 0; head < c.head; head++)
      for (let eyes = 0; eyes < c.eyes; eyes++)
        for (let antenna = 0; antenna < c.antenna; antenna++)
          for (let mouth = 0; mouth < c.mouth; mouth++)
            for (let pattern = 0; pattern < c.pattern; pattern++) {
              const g = parseGenome({ v: 1, head, eyes, antenna, mouth, pattern, signature: 0 });
              if (!g) { problems.push(`unparseable ${head}${eyes}${antenna}${mouth}${pattern}`); continue; }
              problems.push(...figureProblems(composeCells(g)).map((p) => `${serializeGenome(g)}: ${p}`));
            }
    expect(problems.slice(0, 5)).toEqual([]);
  });
  it("paints the base layer before the antenna, mouth and eyes", () => {
    const order = composeCells(genomeFromSeed("layers")).map((d) => d.part);
    const rank = { body: 0, accent: 0, antenna: 1, mouth: 2, eye: 3 } as const;
    for (let i = 1; i < order.length; i++) expect(rank[order[i]]).toBeGreaterThanOrEqual(rank[order[i - 1]]);
  });
  it("composes at least 150 distinct cell sets across 200 seeds", () => {
    const set = new Set(Array.from({ length: 200 }, (_, i) => cellKey(composeCells(genomeFromSeed(`bot${i}`)))));
    expect(set.size).toBeGreaterThanOrEqual(150);
  });
});
