// Same pattern the database enforces on bots.name.
const NAME = /^[a-z0-9_]{2,32}$/;

export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  "admin", "api", "me", "new", "edit", "settings", "status", "docs", "learn",
  "greedy", "safe_expander", "hunter", "random", "papersseum",
  "house_greedy_1", "house_greedy_2", "house_safe_expander_1", "house_safe_expander_2", "house_random",
]);

export function validateBotName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = raw.trim().toLowerCase();
  if (!NAME.test(name)) return { ok: false, message: "Use 2 to 32 characters: lowercase letters, digits and underscores." };
  if (RESERVED_NAMES.has(name)) return { ok: false, message: "That name is reserved. Pick another." };
  return { ok: true, name };
}
