"use client";

import { useRef } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "@/lib/gsap";

// A number that counts up from zero the first time it scrolls into view. It renders the
// final value on the server and on hydration, and only rewrites its own text from an
// effect, so the markup React hydrates always matches. Reduced motion: the value stays.
export function CountUp({ value, delay = 0 }: { value: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const obj = { v: 0 };
        gsap.to(obj, {
          v: value,
          duration: 1.4,
          delay,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
          onStart: () => {
            el.textContent = "0";
          },
          onUpdate: () => {
            el.textContent = Math.round(obj.v).toLocaleString("en-IN");
          },
        });
      });
      return () => mm.revert();
    },
    { dependencies: [value, delay] },
  );
  return <span ref={ref}>{value.toLocaleString("en-IN")}</span>;
}
