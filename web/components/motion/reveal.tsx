'use client';
import { useRef, type ReactNode } from 'react';
import { gsap, loadSplitText, MOTION_OK, REDUCE, useGSAP } from '@/lib/gsap';
import { dur, staggerFor } from '@/lib/motion';

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'div' | 'span';

type RevealProps = {
  as?: Tag;
  /** Split into lines and slide each up behind a mask. Otherwise the whole element fades in. */
  lines?: boolean;
  className?: string;
  id?: string;
  children: ReactNode;
};

/**
 * Entry reveal. Server HTML is fully visible; styles/motion.css hides [data-reveal] only
 * while html.js is set and motion is allowed, and this component brings it back.
 */
export function Reveal({ as: Component = 'div', lines = false, className, id, children }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const mm = gsap.matchMedia();

      mm.add(MOTION_OK, (ctx, contextSafe) => {
        if (!lines) {
          gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: dur.slow, ease: 'smooth' });
          return;
        }
        Promise.all([loadSplitText(), document.fonts.ready]).then(([SplitText]) => {
          if (ctx.isReverted || !contextSafe) return;
          contextSafe(() => {
            gsap.set(el, { opacity: 1 });
            SplitText.create(el, {
              type: 'lines',
              mask: 'lines',
              autoSplit: true,
              onSplit(self) {
                return gsap.from(self.lines, { yPercent: 110, stagger: staggerFor(self.lines.length), duration: dur.slow, ease: 'smooth' });
              },
            });
          })();
        });
      });

      mm.add(REDUCE, () => {
        gsap.set(el, { opacity: 1 });
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [lines] },
  );

  return (
    <Component ref={(node: HTMLElement | null) => { ref.current = node; }} data-reveal="" className={className} id={id}>
      {children}
    </Component>
  );
}
