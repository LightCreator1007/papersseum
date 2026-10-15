'use client';
// The only module that registers GSAP plugins. Import gsap from here, never from 'gsap' directly.
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { CustomEase } from 'gsap/CustomEase';
import { bezier, dur } from './motion';

gsap.registerPlugin(useGSAP, ScrollTrigger, Flip, CustomEase);
CustomEase.create('smooth', bezier.smooth);
CustomEase.create('swing', bezier.swing);
CustomEase.create('move', bezier.move);
gsap.defaults({ duration: dur.moderate, ease: 'smooth' });

export const loadSplitText = () => import('gsap/SplitText').then((m) => { gsap.registerPlugin(m.SplitText); return m.SplitText; });
export const loadScramble = () => import('gsap/ScrambleTextPlugin').then((m) => { gsap.registerPlugin(m.ScrambleTextPlugin); return m.ScrambleTextPlugin; });
export const loadDrawSVG = () => import('gsap/DrawSVGPlugin').then((m) => { gsap.registerPlugin(m.DrawSVGPlugin); return m.DrawSVGPlugin; });
export const REDUCE = '(prefers-reduced-motion: reduce)';
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
export { gsap, useGSAP, ScrollTrigger, Flip };
