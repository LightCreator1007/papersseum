// Chapter 13's Elo calculator. Mirrors resources/chapters/13-multi-agent/code/elo.py.

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

// New ratings after a game where A scored `scoreA` (1 win, 0.5 draw, 0 loss).
export function update(ratingA: number, ratingB: number, scoreA: number, k = 32): [number, number] {
  const e = expectedScore(ratingA, ratingB);
  return [ratingA + k * (scoreA - e), ratingB + k * (1 - scoreA - (1 - e))];
}
