// Notes for the Versions table on /me: what replaced a superseded version, and how to fix
// a rejected one. Kinds come from papersseum/security/static_check.py.

type Version = { version: number; status: string };

// A superseded version was replaced by the next later version that passed the check.
// After a rollback the replacement can be older, so fall back to the active version.
export function replacedBy(subs: Version[], sub: Version, activeVersion: number | null): number | null {
  let next: number | null = null;
  for (const s of subs) {
    if (s.version <= sub.version) continue;
    if (s.status !== "active" && s.status !== "superseded") continue;
    if (next === null || s.version < next) next = s.version;
  }
  if (next !== null) return next;
  return activeVersion !== null && activeVersion !== sub.version ? activeVersion : null;
}

const KIND_HINTS: Record<string, string> = {
  syntax: "Fix the syntax error, then run papersseum validate agent.py before uploading.",
  import: "Remove the import. Bots can use numpy, papersseum and plain standard modules like math, random and collections.",
  call: "Remove the call. Bots can't read files or run code built from strings.",
  attr: "Remove it. Python internals like __globals__ are blocked.",
  name: "Remove it. Python internals like __builtins__ are blocked.",
  weights: "Embed your weights with papersseum pack and read them with unpack_weights.",
  size: "Keep the file under 1 MB. papersseum pack stores weights compactly.",
};

const ERROR_HINTS: { match: RegExp; hint: string }[] = [
  { match: /class named '?Agent'?/i, hint: "Define a class named Agent in the file." },
];

// One hint per kind of problem, in the order the kinds first appear.
export function fixHints(violations: { kind: string }[], error: string | null): string[] {
  const out: string[] = [];
  for (const v of violations) {
    const hint = KIND_HINTS[v.kind];
    if (hint && !out.includes(hint)) out.push(hint);
  }
  if (error) {
    for (const e of ERROR_HINTS) if (e.match.test(error) && !out.includes(e.hint)) out.push(e.hint);
  }
  return out;
}
