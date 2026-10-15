// When the replay can't be shown, the match page still knows how the board
// ended: each seat's final coverage. This turns the recorded seats into the
// rows of a static final-territory bar. Pure, so it is unit-tested.
import type { ExpectedSeat } from "@/features/replay/replay-verdict";

// coverage is the recorded percentage (for the label); width is the share of
// the bar, which differs only when the recorded coverages add up to over 100.
export type FinalShare = { slot: number; name: string; placement: number | null; coverage: number | null; width: number };
export type FinalBoard = { shares: FinalShare[]; unclaimed: number };

const known = (n: number | null): n is number => n !== null && Number.isFinite(n);
const clamp = (n: number) => Math.min(100, Math.max(0, n));

// Null when no seat has a recorded coverage: there is nothing to draw.
export function finalBoard(seats: ExpectedSeat[] | undefined): FinalBoard | null {
  if (!seats?.length || !seats.some((s) => known(s.coverage))) return null;
  const claimed = seats.reduce((sum, s) => sum + (known(s.coverage) ? clamp(s.coverage) : 0), 0);
  const scale = claimed > 100 ? 100 / claimed : 1;
  const shares = seats
    .map((s) => ({
      slot: s.slot,
      name: s.name ?? "deleted bot",
      placement: s.placement,
      coverage: known(s.coverage) ? clamp(s.coverage) : null,
      width: known(s.coverage) ? clamp(s.coverage) * scale : 0,
    }))
    .sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9) || a.slot - b.slot);
  return { shares, unclaimed: clamp(100 - claimed) };
}
