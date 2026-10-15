import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Review focus 1: with JS off or prefers-reduced-motion: reduce, nothing may rest at opacity 0
// or at an entry offset. Any hidden or offset initial state must live under
// `@media (prefers-reduced-motion: no-preference)` and be gated by `html.js`.

const web = fileURLToPath(new URL('../../..', import.meta.url));
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');

type Rule = { selector: string; decls: string; parents: string[] };

/** Small nested-CSS walker: every block with declarations, plus its enclosing preludes. */
function rules(source: string): Rule[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const stack: { prelude: string; decls: string }[] = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') {
      stack.push({ prelude: buf.trim(), decls: '' });
      buf = '';
    } else if (ch === '}') {
      const top = stack.pop();
      if (!top) throw new Error('unbalanced braces');
      top.decls += buf;
      buf = '';
      if (top.decls.trim()) out.push({ selector: top.prelude, decls: top.decls, parents: stack.map((s) => s.prelude) });
    } else if (ch === ';' && stack.length) {
      stack[stack.length - 1].decls += buf + ';';
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (stack.length) throw new Error('unbalanced braces');
  return out;
}

// Selectors describing an interaction or toggled state, not a resting initial state.
const STATE = /:(hover|focus|focus-visible|focus-within|active|checked|popover-open)\b|\[(open|data-state|aria-expanded|aria-selected|aria-pressed|aria-busy)\b/;

/** `opacity: 0`, or a literal entry offset. Transforms built only from `--js-*` custom properties are JS-measured resting positions. */
function initialStateDecl(decls: string): string | null {
  for (const raw of decls.split(';')) {
    const m = raw.match(/^\s*(opacity|transform)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const [, prop, value] = m;
    if (prop === 'opacity' && /^0(\.0+)?%?$/.test(value)) return raw.trim();
    if (prop === 'transform' && value !== 'none') {
      const vars = value.match(/var\(--[\w-]+/g) ?? [];
      const jsOnly = vars.length > 0 && vars.every((v) => v.startsWith('var(--js-')) && !/\d(px|%|deg|rem|em)/.test(value);
      if (!jsOnly) return raw.trim();
    }
  }
  return null;
}

/** Splits a selector list on top-level commas only, so `:not(a, b)` stays whole. */
function splitSelectors(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function violations(file: string): string[] {
  const bad: string[] = [];
  for (const r of rules(read(file))) {
    if (r.selector.startsWith('@') || r.parents.some((p) => /^@(keyframes|starting-style)\b/.test(p))) continue;
    const decl = initialStateDecl(r.decls);
    if (!decl) continue;
    const gated = r.parents.some((p) => /^@media\b.*prefers-reduced-motion:\s*no-preference/.test(p));
    for (const sel of splitSelectors(r.selector)) {
      if (STATE.test(sel)) continue;
      if (!gated || !sel.startsWith('html.js')) bad.push(`${file}: "${sel}" sets ${decl}`);
    }
  }
  return bad;
}

function walk(dir: string, exts: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.test(name)) out.push(p);
  }
  return out;
}

describe('motion-safe initial states', () => {
  it('the CSS walker sees nesting', () => {
    const r = rules('@media (x) { a { opacity: 0; } }');
    expect(r.map((x) => ({ ...x, decls: x.decls.trim() }))).toEqual([{ selector: 'a', decls: 'opacity: 0;', parents: ['@media (x)'] }]);
  });

  it('keeps :not(a, b) as one selector', () => {
    expect(splitSelectors('a:not(:disabled, [x="1"]), b')).toEqual(['a:not(:disabled, [x="1"])', 'b']);
  });

  it('flags an ungated hidden state', () => {
    const r = rules('[data-reveal] { opacity: 0; }')[0];
    expect(initialStateDecl(r.decls)).toBe('opacity: 0');
  });

  it('hides [data-reveal] only when JS is on and motion is allowed', () => {
    const reveal = rules(read('styles/motion.css')).filter((r) => r.selector.includes('[data-reveal]') && /opacity:\s*0\b/.test(r.decls));
    expect(reveal.length).toBeGreaterThan(0);
    for (const r of reveal) {
      expect(r.selector.startsWith('html.js')).toBe(true);
      expect(r.parents.some((p) => /prefers-reduced-motion:\s*no-preference/.test(p))).toBe(true);
    }
  });

  it('motion.css and base.css gate every opacity 0 or transform initial state', () => {
    expect([...violations('styles/motion.css'), ...violations('styles/base.css')]).toEqual([]);
  });

  it('never uses transition: all', () => {
    const files = ['styles', 'components', 'features', 'app'].flatMap((d) => walk(join(web, d), /\.(css|tsx?)$/)).filter((f) => !/\.test\.tsx?$/.test(f));
    const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const offenders = files.filter((f) => /transition(-property)?\s*:\s*['"]?all\b/.test(code(f)));
    expect(offenders).toEqual([]);
  });
});
