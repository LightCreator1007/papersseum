import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dur, durMs, ease, staggerFor, STAGGER } from '@/lib/motion';

const css = readFileSync(new URL('../../../styles/tokens.css', import.meta.url), 'utf8');
const cssVal = (name: string) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))![1].trim();

describe('motion tokens', () => {
  it('JS durations mirror CSS', () => {
    expect(`${durMs.instant}ms`).toBe(cssVal('dur-instant'));
    expect(`${durMs.fast}ms`).toBe(cssVal('dur-fast'));
    expect(`${durMs.moderate}ms`).toBe(cssVal('dur-moderate'));
    expect(`${durMs.slow}ms`).toBe(cssVal('dur-slow'));
    expect(dur.slow).toBeCloseTo(0.42);
  });
  it('JS eases mirror CSS', () => {
    expect(ease.smooth).toBe(cssVal('ease-smooth'));
    expect(ease.swing).toBe(cssVal('ease-swing'));
    expect(ease.move).toBe(cssVal('ease-move'));
  });
  it('stagger never exceeds 500ms total', () => {
    expect(staggerFor(5)).toBe(STAGGER);
    expect(staggerFor(100) * 99).toBeLessThanOrEqual(0.5 + 1e-9);
  });
});
