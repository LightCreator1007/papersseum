"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { dur } from "@/lib/motion";
import { cx } from "./cx";
import styles from "./cell.module.css";

type CellProps = {
  as?: ElementType;
  /** Crosshair marks at two corners, as at the intersections of the hairline grid. */
  crosshair?: boolean;
  /** A soft radial that follows the cursor. Fine pointers and full motion only. */
  glow?: boolean;
  className?: string;
  children: ReactNode;
};

const FINE_AND_MOTION = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

export function Cell({ as: Tag = "div", crosshair = false, glow = false, className, children }: CellProps) {
  const ref = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!glow || !el) return;
      const mm = gsap.matchMedia();
      mm.add(FINE_AND_MOTION, () => {
        // quickTo eases a plain object; onUpdate writes it out as px, since a custom property carries no unit.
        const pos = { x: -400, y: -400 };
        const write = () => {
          el.style.setProperty("--js-mx", `${pos.x}px`);
          el.style.setProperty("--js-my", `${pos.y}px`);
        };
        const x = gsap.quickTo(pos, "x", { duration: dur.moderate, ease: "smooth", onUpdate: write });
        const y = gsap.quickTo(pos, "y", { duration: dur.moderate, ease: "smooth", onUpdate: write });
        const move = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          x(e.clientX - r.left);
          y(e.clientY - r.top);
        };
        el.addEventListener("pointermove", move);
        return () => el.removeEventListener("pointermove", move);
      });
    },
    { dependencies: [glow], scope: ref },
  );

  return (
    <Tag ref={ref} className={cx(styles.cell, crosshair && "grid-cell", glow && styles.glow, className)}>
      {children}
    </Tag>
  );
}
