// Upload checks shared by the browser (before sending) and the server.
// Matches MAX_BYTES in papersseum/security/static_check.py, the validation that actually decides.
export const MAX_BYTES = 1_000_000;
export const GENERIC_UPLOAD_ERROR = "Upload failed, please try again.";
export const SESSION_EXPIRED = "Your session expired. Sign in again to upload.";
export const NO_BOT_MESSAGE = "Your account has no bot to upload to. Open an issue on GitHub and an organiser will sort it out.";
export const STORAGE_DOWN_MESSAGE =
  "File storage isn't responding, so nothing was uploaded and your cooldown wasn't used. Try again in a minute.";
export const CONCURRENT_UPLOAD_MESSAGE = "Another upload just started. Give it a moment.";
export const NETWORK_ERROR = "Couldn't reach the server. Check your connection and try again.";
export const NOTEBOOK_MESSAGE = "Notebooks can't run here. Export it as a .py file (File, Download as, Python).";

export function checkFile(name: string, size: number): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ipynb")) return NOTEBOOK_MESSAGE;
  if (!lower.endsWith(".py")) return "Choose a .py file.";
  if (size === 0) return "That file is empty.";
  if (size > MAX_BYTES) return "That file is over 1 MB.";
  return null;
}

export function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export const identicalMessage = (version: number) =>
  `Identical to v${version}. Nothing uploaded, and your cooldown wasn't used.`;

type HashMatch = { version: number; status: string; error: string | null };

// A file whose check couldn't run on our side is the one case where re-sending the same
// bytes is the right retry, so that version doesn't count as a duplicate.
export function identicalVersion(matches: HashMatch[]): number | null {
  let best: number | null = null;
  for (const m of matches) {
    if (m.status === "rejected" && m.error?.startsWith("Validation could not run")) continue;
    if (best === null || m.version > best) best = m.version;
  }
  return best;
}

// The database serialises uploads per bot, so a second tab waits for the first and then
// hits the cooldown. A newest submission this recent means the first tab just won.
export const JUST_STARTED_MS = 30_000;

export function startedJustNow(newestCreatedAt: string | null | undefined, now: number): boolean {
  if (!newestCreatedAt) return false;
  const at = Date.parse(newestCreatedAt);
  return Number.isFinite(at) && now - at < JUST_STARTED_MS;
}

// api_create_submission's cooldown error says "Please wait HH:MM:SS before ...".
export function waitText(message: string): string | null {
  const m = /(\d+):(\d{2}):(\d{2})/.exec(message);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  const seconds = Number(m[3]);
  if (minutes && seconds) return `${minutes} min ${seconds} s`;
  return minutes ? `${minutes} min` : `${seconds} s`;
}

export function uploadErrorMessage(code: string | undefined, message: string, opts: { justStarted?: boolean } = {}): string {
  switch (code) {
    case "PS001":
      return "Submissions are closed for this season.";
    case "PS002":
      return NO_BOT_MESSAGE;
    case "PS003":
      return "This bot is banned, so it can't take uploads. If you think that's a mistake, open an issue on GitHub.";
    case "PS004": {
      if (opts.justStarted) return CONCURRENT_UPLOAD_MESSAGE;
      const wait = waitText(message);
      return wait ? `You can upload again in ${wait}.` : "You uploaded recently. Try again in a few minutes.";
    }
    default:
      return GENERIC_UPLOAD_ERROR;
  }
}
