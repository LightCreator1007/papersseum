"use client";

import { useEffect } from "react";

// Publishes how far down the page the home hero starts as --hero-top, so the hero can fill
// exactly the rest of the viewport. Whatever sits above it (the header, the paused banner)
// can change height after load, so the page is observed and the value re-read.
export function HeroFit() {
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>("[data-hero]");
    if (!hero) return;
    const set = () => hero.style.setProperty("--hero-top", `${hero.getBoundingClientRect().top + window.scrollY}px`);
    set();
    const observer = new ResizeObserver(set);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);
  return null;
}
