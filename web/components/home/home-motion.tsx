"use client";

import { gsap, MOTION_OK, ScrollTrigger, useGSAP } from "@/lib/gsap";

// Page-level choreography for the home page. Targets are marked with data
// attributes in app/page.tsx so the server markup stays plain:
//   [data-boot-arena]   the product window rises and unclips from its centre
// Count-ups are not here: they live in CountUp, which owns its own text, because
// rewriting server markup in a boundary that has not hydrated yet breaks hydration.
//   [data-parallax]     drifts against the scroll by its value (px over the hero's height)
//   [data-tilt]         rotates slightly as the hero scrolls away
// Reduced motion: nothing runs and everything is already in place.
export function HomeMotion() {
  useGSAP(() => {
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const arena = document.querySelector<HTMLElement>("[data-boot-arena]");
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      if (arena) {
        tl.fromTo(
          arena,
          { clipPath: "inset(40% 30% 40% 30% round 14px)", y: 80, scale: 0.92, opacity: 0 },
          { clipPath: "inset(0% 0% 0% 0% round 14px)", y: 0, scale: 1, opacity: 1, duration: 1.3 },
          0.35,
        );
      }

      const hero = document.querySelector<HTMLElement>("[data-hero]");
      if (hero) {
        document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
          gsap.to(el, {
            y: Number(el.dataset.parallax) || 0,
            ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
          });
        });
        document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
          gsap.to(el, {
            rotate: Number(el.dataset.tilt) || 0,
            scale: 0.94,
            ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
          });
        });
      }
    });
    return () => mm.revert();
  });
  return null;
}
