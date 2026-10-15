// Where to send someone after sign-in. Only same-site paths are allowed:
// "//host" and "/\host" are treated by browsers as other sites, and browsers
// strip tabs and newlines, so "/\t/host" becomes "//host".
export function safeNext(next: string | null | undefined, fallback = "/me"): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next) || next.startsWith("//")) return fallback;
  return next;
}
