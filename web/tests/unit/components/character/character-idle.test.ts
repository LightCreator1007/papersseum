import { describe, expect, it } from 'vitest';
import { cellIndex, dropFor, gaze, GAZE_REACH, seededPhase } from '@/components/character/character-idle';

describe('character motion helpers', () => {
  it('gaze is zero at the centre and never exceeds half a cell', () => {
    expect(gaze(0, 0)).toEqual({ x: 0, y: 0 });
    for (const [dx, dy] of [[1, 0], [0, -1], [5, 5], [-40, 3], [0.1, 0.1], [1e6, -1e6]]) {
      const g = gaze(dx, dy);
      expect(Math.hypot(g.x, g.y)).toBeLessThanOrEqual(GAZE_REACH + 1e-9);
    }
  });

  it('gaze points toward the pointer and saturates far away', () => {
    const right = gaze(10, 0);
    expect(right.x).toBeCloseTo(GAZE_REACH);
    expect(right.y).toBeCloseTo(0);
    const upLeft = gaze(-10, -10);
    expect(upLeft.x).toBeLessThan(0);
    expect(upLeft.y).toBeLessThan(0);
    expect(Math.abs(gaze(0.2, 0).x)).toBeLessThan(GAZE_REACH);
  });

  it('seededPhase is deterministic, in [0, 1), and differs across keys', () => {
    const keys = ['a', 'snake_eater', 'house_hunter', '', 'Ω-bot', '🤖🤖'];
    const phases = keys.map(seededPhase);
    for (const [i, k] of keys.entries()) {
      expect(seededPhase(k)).toBe(phases[i]);
      expect(phases[i]).toBeGreaterThanOrEqual(0);
      expect(phases[i]).toBeLessThan(1);
    }
    expect(new Set(phases).size).toBe(keys.length);
  });

  it('dropFor is a whole-cell drop keyed by position, so an eye falls with its body cell', () => {
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        const d = dropFor('k', x, y);
        expect(Number.isInteger(d)).toBe(true);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(3);
        expect(dropFor('k', x, y)).toBe(d);
      }
    }
    const all = Array.from({ length: 144 }, (_, i) => dropFor('k', i % 12, Math.floor(i / 12)));
    expect(new Set(all).size).toBeGreaterThan(1);
  });

  it('cellIndex is row-major on the 12x12 grid', () => {
    expect(cellIndex(0, 0)).toBe(0);
    expect(cellIndex(11, 0)).toBe(11);
    expect(cellIndex(0, 1)).toBe(12);
    expect(cellIndex(11, 11)).toBe(143);
  });
});
