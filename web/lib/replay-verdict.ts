// Whether a re-run match agrees with what was recorded, and how to say so.
// Inputs from replay files are untrusted: parseResult() and seatNames() accept
// anything and fall back instead of throwing.
import type { MatchResult, SeatScore } from "@/lib/engine-protocol";
import { percent } from "@/lib/format";

const SEATS = 5;
// Coverage is a percentage; match_players.coverage is float4, so values read
// back from the database differ from the engine's doubles by up to ~4e-6.
export const COVERAGE_TOLERANCE = 1e-5;

export type ExpectedSeat = { slot: number; name: string | null; placement: number | null; coverage: number | null };
type Facts = { place: number | null; coverage: number | null };
export type SeatDiff = { slot: number; got: { place: number; coverage: number }; recorded: Facts };
export type Verdict =
  | { kind: "verified" }
  | { kind: "mismatch"; seats: SeatDiff[] }
  | { kind: "older-engine"; engineHash: string | null }
  | { kind: "unchecked" };

const isInt = (v: unknown): v is number => Number.isInteger(v);
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const inSeats = (slot: unknown): slot is number => isInt(slot) && slot >= 0 && slot < SEATS;

// A replay's result line if it is well formed, else null.
export function parseResult(raw: unknown): MatchResult | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { scores, placements } = raw as { scores?: unknown; placements?: unknown };
  if (!Array.isArray(placements) || placements.length !== SEATS || !placements.every(isInt)) return null;
  if ([...placements].sort((a, b) => a - b).join() !== "0,1,2,3,4") return null;
  if (!Array.isArray(scores) || scores.length !== SEATS) return null;
  const parsed: SeatScore[] = [];
  for (const s of scores) {
    if (typeof s !== "object" || s === null) return null;
    const { pid, coverage } = s as { pid?: unknown; coverage?: unknown };
    if (!inSeats(pid) || !isNumber(coverage)) return null;
    parsed.push({ pid, coverage });
  }
  if ([...parsed].map((s) => s.pid).sort((a, b) => a - b).join() !== "0,1,2,3,4") return null;
  return { scores: parsed, placements: placements as number[] };
}

function factsOf(result: MatchResult): Facts[] {
  const out: Facts[] = Array.from({ length: SEATS }, () => ({ place: null, coverage: null }));
  result.placements.forEach((slot, i) => {
    if (inSeats(slot)) out[slot].place = i + 1;
  });
  for (const s of result.scores) if (inSeats(s.pid)) out[s.pid].coverage = s.coverage;
  return out;
}

function factsOfSeats(seats: ExpectedSeat[]): Facts[] {
  const out: Facts[] = Array.from({ length: SEATS }, () => ({ place: null, coverage: null }));
  for (const s of seats) if (inSeats(s.slot)) out[s.slot] = { place: s.placement, coverage: s.coverage };
  return out;
}

const hasFacts = (facts: Facts[]) => facts.some((f) => f.place !== null || f.coverage !== null);

export function verdict(input: {
  shippedHash: string;
  engineHash: unknown;
  got: MatchResult;
  recorded: MatchResult | null;
  expected?: ExpectedSeat[];
}): Verdict {
  if (input.engineHash !== input.shippedHash) {
    return { kind: "older-engine", engineHash: typeof input.engineHash === "string" ? input.engineHash : null };
  }
  const references = [
    ...(input.recorded ? [factsOf(input.recorded)] : []),
    ...(input.expected ? [factsOfSeats(input.expected)] : []),
  ].filter(hasFacts);
  if (!references.length) return { kind: "unchecked" };

  const got = factsOf(input.got);
  const seats: SeatDiff[] = [];
  for (let slot = 0; slot < SEATS; slot++) {
    const mine = { place: got[slot].place ?? 0, coverage: got[slot].coverage ?? 0 };
    const disagreeing = references.find((ref) => {
      const r = ref[slot];
      const placeOff = r.place !== null && r.place !== mine.place;
      const coverageOff = r.coverage !== null && !(Math.abs(r.coverage - mine.coverage) <= COVERAGE_TOLERANCE);
      return placeOff || coverageOff;
    });
    if (disagreeing) seats.push({ slot, got: mine, recorded: disagreeing[slot] });
  }
  return seats.length ? { kind: "mismatch", seats } : { kind: "verified" };
}

const MAX_NAME = 40;

// One display name per seat: database names on the match page, else the
// replay header's bot_name, else "Player N".
export function seatNames(players: unknown, expected?: ExpectedSeat[]): string[] {
  const names = Array.from({ length: SEATS }, (_, slot) => `Player ${slot + 1}`);
  if (expected?.length) {
    for (const s of expected) if (inSeats(s.slot)) names[s.slot] = s.name ?? "deleted bot";
    return names;
  }
  if (!Array.isArray(players)) return names;
  for (const p of players) {
    if (typeof p !== "object" || p === null) continue;
    const { slot, bot_name } = p as { slot?: unknown; bot_name?: unknown };
    if (!inSeats(slot) || typeof bot_name !== "string" || !bot_name.trim()) continue;
    names[slot] = bot_name.trim().slice(0, MAX_NAME);
  }
  return names;
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th"];
const place = (n: number | null) => (n === null ? "—" : (ORDINALS[n - 1] ?? `${n}th`));

export function verdictText(v: Verdict, names: string[]): string {
  switch (v.kind) {
    case "verified":
      return "Verified: the engine reproduced this result.";
    case "unchecked":
      return "No recorded result to check this replay against.";
    case "older-engine":
      return v.engineHash
        ? `Recorded on an older engine (${v.engineHash.slice(0, 12)}…), so this result can't be verified.`
        : "Recorded on an older engine, so this result can't be verified.";
    case "mismatch":
      return (
        "Result mismatch: " +
        v.seats
          .map(
            (s) =>
              `${names[s.slot]} placed ${place(s.got.place)} with ${percent(s.got.coverage)} here, ` +
              `recorded ${place(s.recorded.place)} with ${percent(s.recorded.coverage)}`,
          )
          .join("; ") +
        "."
      );
  }
}
