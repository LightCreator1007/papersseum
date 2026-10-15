// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { animate } from 'animejs';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { useAnimeScope } from '@/lib/anime';
import { durMs } from '@/lib/motion';
import { SmoothScroll } from '@/components/motion/smooth-scroll';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

function Probe() {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      gsap.to('.st', { x: 100, scrollTrigger: { trigger: '.st', start: 'top bottom', scrub: true } });
    },
    { scope: root },
  );
  useAnimeScope(root, () => {
    animate('.loop', { translateX: 50, loop: true, duration: durMs.loop });
  });
  return (
    <div ref={root}>
      <div className="st" />
      <div className="loop" />
    </div>
  );
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

function unmount() {
  act(() => root.unmount());
  host.remove();
}

beforeAll(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('motion cleanup', () => {
  it('useGSAP and useAnimeScope leave no ScrollTrigger or inline transform after unmount', async () => {
    const baseline = ScrollTrigger.getAll().length;
    mount(<Probe />);
    expect(ScrollTrigger.getAll().length).toBe(baseline + 1);
    const target = host.querySelector<HTMLElement>('.loop')!;
    await frames(4);
    expect(target.style.transform).not.toBe('');

    unmount();
    expect(ScrollTrigger.getAll().length).toBe(0);
    expect(target.style.transform).toBe('');
  });

  it('20 mount and unmount cycles return to the ScrollTrigger baseline', async () => {
    const baseline = ScrollTrigger.getAll().length;
    for (let i = 0; i < 20; i++) {
      mount(<Probe />);
      await frames(1);
      unmount();
    }
    expect(ScrollTrigger.getAll().length).toBe(baseline);
  });

  it('SmoothScroll removes its ticker callback and restores lag smoothing', () => {
    const add = vi.spyOn(gsap.ticker, 'add');
    const remove = vi.spyOn(gsap.ticker, 'remove');
    const lag = vi.spyOn(gsap.ticker, 'lagSmoothing');
    mount(<SmoothScroll />);
    expect(add).toHaveBeenCalledTimes(1);
    const tick = add.mock.calls[0][0];

    unmount();
    expect(remove).toHaveBeenCalledWith(tick);
    expect(lag).toHaveBeenLastCalledWith(500, 33);
  });
});
