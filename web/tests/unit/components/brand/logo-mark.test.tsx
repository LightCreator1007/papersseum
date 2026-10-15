// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { CellLoader } from '@/components/brand/cell-loader';
import { LogoMark } from '@/components/brand/logo-mark';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const frames = (n: number) => new Promise<void>((resolve) => {
  const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
  step(n);
});

function stubMedia({ reduced, fine }: { reduced: boolean; fine: boolean }) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduced : q.includes('hover: hover') ? fine : false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

let host: HTMLDivElement;
let root: Root;
const mount = (node: React.ReactNode) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(node));
};

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('LogoMark', () => {
  it('renders a 3x3 viewBox with the four inked cells and the centre, hidden from assistive tech', () => {
    stubMedia({ reduced: true, fine: true });
    mount(<LogoMark size={24} />);
    const svg = host.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 3 3');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    const cells = [...svg.querySelectorAll('rect')].map((r) => [r.dataset.cell, r.getAttribute('x'), r.getAttribute('y')]);
    expect(cells).toEqual([['n', '1', '0'], ['w', '0', '1'], ['e', '2', '1'], ['s', '1', '2'], ['c', '1', '1']]);
  });

  it('exposes the svg through ref for the Home timeline', () => {
    stubMedia({ reduced: true, fine: true });
    const ref = createRef<SVGSVGElement>();
    mount(<LogoMark size={24} animate="boot" ref={ref} />);
    expect(ref.current).toBe(host.querySelector('svg'));
    expect(ref.current?.dataset.animate).toBe('boot');
  });

  it('cycles the ring through the slot colours on hover and clears them on unmount', async () => {
    stubMedia({ reduced: false, fine: true });
    mount(<LogoMark size={24} animate="hover" />);
    const svg = host.querySelector('svg')!;
    const north = svg.querySelector<SVGRectElement>('[data-cell="n"]')!;
    act(() => svg.dispatchEvent(new Event('pointerenter')));
    await frames(6);
    expect(north.style.fill).not.toBe('');
    act(() => root.unmount());
    expect(north.style.fill).toBe('');
    act(() => svg.dispatchEvent(new Event('pointerenter')));
    expect(svg.dataset.hover).toBeUndefined();
    root = createRoot(host);
    act(() => root.render(null));
  });

  it('under reduced motion only flags hover (CSS dims to 0.7) and never colours a cell', async () => {
    stubMedia({ reduced: true, fine: true });
    mount(<LogoMark size={24} animate="hover" />);
    const svg = host.querySelector('svg')!;
    act(() => svg.dispatchEvent(new Event('pointerenter')));
    await frames(6);
    expect(svg.dataset.hover).toBe('true');
    expect([...svg.querySelectorAll<SVGRectElement>('rect')].every((r) => r.style.fill === '')).toBe(true);
    act(() => svg.dispatchEvent(new Event('pointerleave')));
    expect(svg.dataset.hover).toBeUndefined();
  });

  it('does nothing on coarse pointers', () => {
    stubMedia({ reduced: false, fine: false });
    mount(<LogoMark size={24} animate="hover" />);
    const svg = host.querySelector('svg')!;
    act(() => svg.dispatchEvent(new Event('pointerenter')));
    expect(svg.dataset.hover).toBeUndefined();
  });
});

describe('CellLoader', () => {
  it('is a status region named by its label with nine cells', () => {
    const html = renderToStaticMarkup(<CellLoader label="Loading matches" />);
    host = document.createElement('div');
    host.innerHTML = html;
    root = createRoot(document.createElement('div'));
    const status = host.querySelector('[role="status"]')!;
    expect(status.textContent).toBe('Loading matches');
    expect(status.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(9);
  });
});
