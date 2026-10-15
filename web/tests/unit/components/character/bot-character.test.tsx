// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { compose } from '@/lib/character/compose';
import { genomeFromSeed } from '@/lib/character/genome';
import { BotCharacter } from '@/components/character/bot-character';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const frames = (n: number) => new Promise<void>((resolve) => {
  const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
  step(n);
});

let host: HTMLDivElement;
let root: Root;

function mount(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(node));
}

function rerender(node: React.ReactNode) {
  act(() => root.render(node));
}

function unmount() {
  act(() => root.unmount());
  host.remove();
}

function reduceMotion(on: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({
    matches: on && q.includes('reduce'),
    media: q,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.restoreAllMocks();
});

const genome = genomeFromSeed('house_random');

describe('BotCharacter', () => {
  it('renders an accessible, crisp 12x12 svg at the requested size', () => {
    reduceMotion(true);
    mount(<BotCharacter genome={genome} size={48} accent="var(--slot-2)" state="still" label="house_random" />);
    const svg = host.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 12 12');
    expect(svg.getAttribute('shape-rendering')).toBe('crispEdges');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('house_random');
    expect(svg.getAttribute('width')).toBe('48');
    expect(svg.getAttribute('height')).toBe('48');
    expect(svg.getAttribute('data-state')).toBe('still');
    expect(svg.style.getPropertyValue('--bot-accent')).toBe('var(--slot-2)');
    unmount();
  });

  it('paints one rect per composed cell, in compose order, tagged with its part', () => {
    reduceMotion(true);
    mount(<BotCharacter genome={genome} size={24} accent="#35e07f" state="idle" label="b" />);
    const rects = [...host.querySelectorAll('rect')];
    const cells = compose(genome);
    expect(rects).toHaveLength(cells.length);
    rects.forEach((r, i) => {
      expect(r.getAttribute('x')).toBe(String(cells[i].x));
      expect(r.getAttribute('y')).toBe(String(cells[i].y));
      expect(r.getAttribute('width')).toBe('1');
      expect(r.getAttribute('height')).toBe('1');
      expect(r.getAttribute('data-part')).toBe(cells[i].part);
    });
    unmount();
  });

  it('reduced motion leaves every state as a still pose with no inline animation styles', async () => {
    reduceMotion(true);
    for (const state of ['idle', 'working', 'win', 'dead'] as const) {
      mount(<BotCharacter genome={genome} size={48} accent="#35e07f" state={state} label="b" lookAt />);
      await frames(3);
      const styled = [...host.querySelectorAll<SVGElement>('svg, g, rect')].filter((el) => el.style.transform || el.style.opacity || el.style.fill);
      expect(styled).toHaveLength(0);
      expect(host.querySelector('svg')!.getAttribute('data-state')).toBe(state);
      unmount();
    }
  });

  it('animates the dead drop and reverts it when the state changes', async () => {
    reduceMotion(false);
    mount(<BotCharacter genome={genome} size={48} accent="#35e07f" state="dead" label="b" />);
    await frames(4);
    const rects = [...host.querySelectorAll<SVGRectElement>('rect')];
    expect(rects.some((r) => r.style.transform !== '')).toBe(true);

    rerender(<BotCharacter genome={genome} size={48} accent="#35e07f" state="still" label="b" />);
    expect(rects.every((r) => r.style.transform === '')).toBe(true);
    expect(host.querySelector('svg')!.style.opacity).toBe('');
    unmount();
  });
});
