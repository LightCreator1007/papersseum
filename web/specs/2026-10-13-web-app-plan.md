# Papersseum Web App (first version) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Papersseum website (home, leaderboard, matches, match, bot profile, my bot with upload, getting started, Google sign-in) on the real local Supabase project.

**Architecture:** Next.js 16 App Router with Cache Components. Pages render on the server through a per-request Supabase client that carries the visitor's session, so the database's row-level security decides what each person sees. Every data read sits in a `<Suspense>` boundary inside a prerendered shell. Only the upload path uses the secret key, from one server-only module. Small client components subscribe to Supabase Realtime and call `router.refresh()`.

**Tech Stack:** Next.js 16.4, React 19.3, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.117, Tailwind 4 (only for its CSS reset), Vitest 5, TypeScript 5, Supabase CLI 2.120.

**Spec:** `web/specs/2026-10-13-web-app-design.md`

## Global Constraints

- Visual style "A · Paper": light `--bg #fafaf8`, `--surface #ffffff`, `--text #111111`, `--muted #666666`, `--rule #e4e4e0`; dark `--bg #121212`, `--surface #181818`, `--text #e8e8e6`, `--muted #9a9a9a`, `--rule #2a2a2a`.
- No gradients, no animated or typewriter text, no badges, pills, tags or decorative icons. Plain buttons. No spinners.
- Dark mode follows `prefers-color-scheme` only. No toggle.
- Player colours by slot, from `papersseum/render.py`: 0 `#ff4d5e`, 1 `#4d9dff`, 2 `#35e07f`, 3 `#ffd23f`, 4 `#b36bff`.
- Sign-in is Google only. Email sign-up is disabled in `supabase/config.toml`.
- The secret key is only ever read in `web/lib/supabase/admin.ts`, which starts with `import "server-only"`.
- Wording: submission `pending`/`validating` → "Checking…", `active` → "Active", `rejected` → "Rejected", `superseded` → "Replaced"; match `queued` → "Waiting", `running` → "Playing", `done` → "Finished", `failed` → "Failed".
- Times are shown in `Asia/Kolkata`. Relative ("4 min ago") under 24 hours, otherwise "7 Oct".
- Uploads: `.py`, 1 to 1,048,576 bytes, UTF-8. Stored at `agents/<bot_id>/<submission_id>.py`.
- Next.js 16 specifics: `proxy.ts` (not middleware), `params`/`searchParams` are Promises, runtime data must be inside `<Suspense>`. Before writing Next.js code, read the relevant guide in `web/node_modules/next/dist/docs/` (see `web/AGENTS.md`).
- Phone width: 16 px side gutter, the page never scrolls sideways; wide tables scroll inside `.table-scroll`.

## Review Focus

1. A crafted `next` after sign-in (`//evil.com`, `/\evil.com`, `/\t/evil.com`, `https://evil.com`) must land on `/me`, never off-site. Tested in Task 1 (`safeNext`).
2. A `.py` that is exactly 1,048,576 bytes is accepted, one byte more is refused, a 0-byte file is refused, and a binary file renamed `.py` is refused with a readable message. Tested in Task 2.
3. A refused upload (cooldown, frozen season) leaves no file behind in the `agents` bucket. Tested in Task 2 against real Supabase.
4. A failed or unfinished match has `null` placement/Elo; the match page must show "—" and never "NaN" or crash. Tested in Task 1 (`eloChange`, `percent`) and checked in Task 6.
5. The cooldown message can carry hours (`01:02:03`) or be reworded by the database; the user sees "62 min 3 s" or a sensible fallback, never a raw SQL string. Tested in Task 2 (`waitText`, `uploadErrorMessage`).

---

## File map

```
web/
  next.config.ts                       modify: serverActions.bodySizeLimit
  package.json                         modify: scripts, vitest, server-only
  vitest.config.ts                     create
  proxy.ts                             create: session refresh
  README.md                            replace: setup, Google console, scripts
  app/
    globals.css                        replace: tokens + all styles
    layout.tsx                         replace: shell, header, footer
    not-found.tsx                      create
    page.tsx                           replace: home
    leaderboard/page.tsx               create
    matches/page.tsx                   create
    matches/[id]/page.tsx              create
    bots/[name]/page.tsx               create
    me/page.tsx                        create
    me/actions.ts                      create: uploadBot server action
    me/upload-form.tsx                 create: client form
    getting-started/page.tsx           create
    sign-in/page.tsx                   create
    auth/actions.ts                    create: signInWithGoogle, signOut
    auth/callback/route.ts             create
  components/
    site-header.tsx  nav-links.tsx  site-footer.tsx
    load-boundary.tsx  placeholder.tsx  live-refresh.tsx  next-round.tsx
    submit-button.tsx  sign-in-button.tsx  swatch.tsx
    leaderboard-table.tsx  match-list.tsx  elo-line.tsx
  lib/
    database.types.ts                  generated
    format.ts  format.test.ts
    redirect.ts  redirect.test.ts
    links.ts
    colors.ts
    elo-line.ts  elo-line.test.ts
    auth-errors.ts  auth-errors.test.ts
    upload-rules.ts  upload-rules.test.ts
    upload.ts  upload.int.test.ts
    queries.ts
    supabase/server.ts  supabase/browser.ts  supabase/admin.ts
  public/board-light.svg  public/board-dark.svg     generated
  scripts/make_board.py
supabase/config.toml                   modify: Google, email sign-up off, redirect URLs
.github/workflows/tests.yml            modify: web job, upload tests in database job
```

All commands below run from `web/` unless they say otherwise. Local Supabase must be running (`supabase start` from the repo root).

---

### Task 1: Test tooling and pure helpers

**Files:**
- Modify: `web/package.json`
- Create: `web/vitest.config.ts`, `web/lib/database.types.ts` (generated), `web/lib/format.ts`, `web/lib/format.test.ts`, `web/lib/redirect.ts`, `web/lib/redirect.test.ts`, `web/lib/links.ts`, `web/lib/colors.ts`, `web/lib/elo-line.ts`, `web/lib/elo-line.test.ts`

**Interfaces:**
- Produces:
  - `format.ts`: `TIME_ZONE`, `relativeTime(iso: string, now?: number): string`, `shortDate(iso)`, `shortDateTime(iso)`, `clockTime(ms: number): string`, `duration(startIso: string, endIso: string): string`, `elo(n: number | null): string`, `eloChange(before: number | null, after: number | null): { text: string; tone: "up" | "down" | "none" } | null`, `percent(n: number | null): string`, `intervalMinutes(text: string): number`, `nextRoundAt(now: number): number`, `minutesUntil(target: number, now: number): number`, `SUBMISSION_STATUS`, `MATCH_STATUS`
  - `redirect.ts`: `safeNext(next: string | null | undefined, fallback?: string): string`
  - `links.ts`: `botHref(name: string): string`, `matchHref(id: number): string`
  - `colors.ts`: `PLAYER_COLORS: readonly string[]`
  - `elo-line.ts`: `eloLinePoints(values: number[], width: number, height: number, pad?: number): string`

- [ ] **Step 1: Install test tooling**

```bash
npm install --save-dev vitest@^5
npm install server-only
```

Edit the `scripts` block in `web/package.json` to:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run --exclude '**/*.int.test.ts'",
    "test:int": "vitest run lib/upload.int.test.ts",
    "gen:types": "supabase gen types typescript --local --schema public --workdir .. > lib/database.types.ts"
  },
```

Create `web/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
});
```

- [ ] **Step 2: Write the failing tests**

`web/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MATCH_STATUS, SUBMISSION_STATUS, clockTime, duration, elo, eloChange, intervalMinutes,
  minutesUntil, nextRoundAt, percent, relativeTime, shortDate, shortDateTime,
} from "@/lib/format";

const NOW = Date.parse("2026-10-13T09:00:00Z"); // 14:30 in Kolkata

describe("relativeTime", () => {
  it("says just now under a minute", () => {
    expect(relativeTime("2026-10-13T08:59:30Z", NOW)).toBe("just now");
  });
  it("counts minutes under an hour", () => {
    expect(relativeTime("2026-10-13T08:56:00Z", NOW)).toBe("4 min ago");
  });
  it("counts hours under a day", () => {
    expect(relativeTime("2026-10-13T06:00:00Z", NOW)).toBe("3 h ago");
  });
  it("falls back to a date after a day", () => {
    expect(relativeTime("2026-10-07T12:00:00Z", NOW)).toBe("7 Oct");
  });
});

describe("dates in Kolkata time", () => {
  it("formats a short date", () => {
    expect(shortDate("2026-10-06T20:00:00Z")).toBe("7 Oct"); // 01:30 on the 7th in IST
  });
  it("formats a date and time", () => {
    expect(shortDateTime("2026-10-07T12:32:00Z")).toBe("7 Oct, 18:02");
  });
  it("formats a clock time", () => {
    expect(clockTime(Date.parse("2026-10-13T09:15:00Z"))).toBe("14:45");
  });
});

describe("duration", () => {
  it("shows minutes and seconds", () => {
    expect(duration("2026-10-13T09:00:00Z", "2026-10-13T09:01:41Z")).toBe("1 min 41 s");
  });
  it("shows only seconds under a minute", () => {
    expect(duration("2026-10-13T09:00:00Z", "2026-10-13T09:00:42Z")).toBe("42 s");
  });
});

describe("numbers", () => {
  it("formats Elo with one decimal", () => {
    expect(elo(1342.64)).toBe("1342.6");
    expect(elo(null)).toBe("—");
  });
  it("formats an Elo gain, loss and no change", () => {
    expect(eloChange(1330.1, 1342.6)).toEqual({ text: "+12.5", tone: "up" });
    expect(eloChange(1303.0, 1298.1)).toEqual({ text: "−4.9", tone: "down" });
    expect(eloChange(1000, 1000)).toEqual({ text: "0.0", tone: "none" });
  });
  it("returns null when either side is missing", () => {
    expect(eloChange(null, 1000)).toBeNull();
    expect(eloChange(1000, null)).toBeNull();
  });
  it("formats coverage as a percentage", () => {
    expect(percent(31.42)).toBe("31.4%");
    expect(percent(null)).toBe("—");
  });
});

describe("intervalMinutes", () => {
  it("reads a Postgres interval", () => {
    expect(intervalMinutes("00:10:00")).toBe(10);
    expect(intervalMinutes("01:30:00")).toBe(90);
  });
  it("returns 0 for anything else", () => {
    expect(intervalMinutes("10 minutes")).toBe(0);
  });
});

describe("next round", () => {
  it("is the next quarter hour", () => {
    expect(nextRoundAt(Date.parse("2026-10-13T09:07:30Z"))).toBe(Date.parse("2026-10-13T09:15:00Z"));
  });
  it("moves on when exactly on a boundary", () => {
    expect(nextRoundAt(Date.parse("2026-10-13T09:15:00Z"))).toBe(Date.parse("2026-10-13T09:30:00Z"));
  });
  it("rounds minutes up and never says 0", () => {
    const now = Date.parse("2026-10-13T09:14:50Z");
    expect(minutesUntil(nextRoundAt(now), now)).toBe(1);
    expect(minutesUntil(Date.parse("2026-10-13T09:15:00Z"), Date.parse("2026-10-13T09:08:10Z"))).toBe(7);
  });
});

describe("status wording", () => {
  it("uses plain words", () => {
    expect(SUBMISSION_STATUS.validating).toBe("Checking…");
    expect(SUBMISSION_STATUS.superseded).toBe("Replaced");
    expect(MATCH_STATUS.queued).toBe("Waiting");
    expect(MATCH_STATUS.done).toBe("Finished");
  });
});
```

`web/lib/redirect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/leaderboard")).toBe("/leaderboard");
    expect(safeNext("/matches/12?x=1")).toBe("/matches/12?x=1");
    expect(safeNext("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com"); // stays a path on our origin
  });
  it.each([
    [null], [undefined], [""], ["leaderboard"], ["https://evil.com"], ["//evil.com"],
    ["/\\evil.com"], ["/\t/evil.com"], ["/\n/evil.com"], ["\\\\evil.com"],
  ])("sends %j to the fallback", (value) => {
    expect(safeNext(value)).toBe("/me");
  });
  it("uses a custom fallback", () => {
    expect(safeNext("//evil.com", "/")).toBe("/");
  });
});
```

`web/lib/elo-line.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eloLinePoints } from "@/lib/elo-line";

describe("eloLinePoints", () => {
  it("spans the width and puts the highest value at the top", () => {
    expect(eloLinePoints([1000, 1100, 1050], 600, 120, 10)).toBe("0,110 300,10 600,60");
  });
  it("draws a flat line through the middle when nothing changed", () => {
    expect(eloLinePoints([1000, 1000], 600, 120, 10)).toBe("0,60 600,60");
  });
  it("returns nothing for no data", () => {
    expect(eloLinePoints([], 600, 120)).toBe("");
  });
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npm test`
Expected: FAIL, "Failed to resolve import "@/lib/format"" (and the same for the other two files).

- [ ] **Step 4: Implement the helpers**

`web/lib/format.ts`:

```ts
import type { Database } from "@/lib/database.types";

export const TIME_ZONE = "Asia/Kolkata";

type SubmissionStatus = Database["public"]["Enums"]["submission_status"];
type MatchStatus = Database["public"]["Enums"]["match_status"];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ROUND_EVERY = 15 * MINUTE; // pg_cron: */15 * * * *

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - Date.parse(iso);
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
  return shortDate(iso);
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TIME_ZONE });
}

export function shortDateTime(iso: string): string {
  return `${shortDate(iso)}, ${clockTime(Date.parse(iso))}`;
}

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE,
  });
}

export function duration(startIso: string, endIso: string): string {
  const secs = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export function elo(n: number | null): string {
  return n === null ? "—" : n.toFixed(1);
}

export function eloChange(before: number | null, after: number | null) {
  if (before === null || after === null) return null;
  const d = Math.round((after - before) * 10) / 10;
  if (d > 0) return { text: `+${d.toFixed(1)}`, tone: "up" as const };
  if (d < 0) return { text: `−${Math.abs(d).toFixed(1)}`, tone: "down" as const };
  return { text: "0.0", tone: "none" as const };
}

export function percent(n: number | null): string {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}

export function intervalMinutes(text: string): number {
  const m = /^(\d+):(\d{2}):(\d{2})$/.exec(text);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

export function nextRoundAt(now: number): number {
  return (Math.floor(now / ROUND_EVERY) + 1) * ROUND_EVERY;
}

export function minutesUntil(target: number, now: number): number {
  return Math.max(1, Math.ceil((target - now) / MINUTE));
}

export const SUBMISSION_STATUS: Record<SubmissionStatus, string> = {
  pending: "Checking…",
  validating: "Checking…",
  active: "Active",
  rejected: "Rejected",
  superseded: "Replaced",
};

export const MATCH_STATUS: Record<MatchStatus, string> = {
  queued: "Waiting",
  running: "Playing",
  done: "Finished",
  failed: "Failed",
};
```

`format.ts` imports `database.types.ts`, which Task 2 generates. Generate it now so this task compiles:

```bash
npm run gen:types
```

`web/lib/redirect.ts`:

```ts
// Where to send someone after sign-in. Only same-site paths are allowed:
// "//host" and "/\host" are treated by browsers as other sites, and browsers
// strip tabs and newlines, so "/\t/host" becomes "//host".
export function safeNext(next: string | null | undefined, fallback = "/me"): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (/[\u0000-\u001f\\]/.test(next) || next.startsWith("//")) return fallback;
  return next;
}
```

`web/lib/links.ts`:

```ts
export const botHref = (name: string) => `/bots/${encodeURIComponent(name)}`;
export const matchHref = (id: number) => `/matches/${id}`;
```

`web/lib/colors.ts`:

```ts
// Slot colours, identical to PLAYER_COLORS in papersseum/render.py so the site
// matches rendered replays.
export const PLAYER_COLORS = ["#ff4d5e", "#4d9dff", "#35e07f", "#ffd23f", "#b36bff"] as const;
```

`web/lib/elo-line.ts`:

```ts
// SVG polyline points for an Elo history, oldest first. Highest value at the top.
export function eloLinePoints(values: number[], width: number, height: number, pad = 4): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const round = (n: number) => Math.round(n * 100) / 100;
  return values
    .map((v, i) => {
      const y = max === min ? height / 2 : pad + (height - 2 * pad) * (1 - (v - min) / (max - min));
      return `${round(i * step)},${round(y)}`;
    })
    .join(" ");
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test`
Expected: PASS, 3 files, all tests green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts lib/
git commit -m "Add web test tooling and formatting helpers"
```

---

### Task 2: Upload logic against real Supabase

**Files:**
- Create: `web/lib/upload-rules.ts`, `web/lib/upload-rules.test.ts`, `web/lib/upload.ts`, `web/lib/upload.int.test.ts`, `web/lib/supabase/admin.ts`

**Interfaces:**
- Consumes: `Database` type from `lib/database.types.ts` (generated and committed in Task 1).
- Produces:
  - `upload-rules.ts` (safe to import in client components): `MAX_BYTES = 1_048_576`, `GENERIC_UPLOAD_ERROR`, `checkFile(name: string, size: number): string | null`, `isUtf8(bytes: Uint8Array): boolean`, `waitText(message: string): string | null`, `uploadErrorMessage(code: string | undefined, message: string): string`
  - `upload.ts` (server only): `type UploadResult = { ok: true; version: number } | { ok: false; message: string }`, `createSubmission(admin: SupabaseClient<Database>, userId: string, file: { name: string; bytes: Uint8Array }): Promise<UploadResult>`
  - `supabase/admin.ts`: `createAdminClient(): SupabaseClient<Database>`

- [ ] **Step 1: Write the failing unit tests**

`web/lib/upload-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GENERIC_UPLOAD_ERROR, MAX_BYTES, checkFile, isUtf8, uploadErrorMessage, waitText } from "@/lib/upload-rules";

describe("checkFile", () => {
  it("accepts a .py file up to exactly 1 MB", () => {
    expect(checkFile("agent.py", 1)).toBeNull();
    expect(checkFile("Agent.PY", MAX_BYTES)).toBeNull();
  });
  it("refuses one byte over 1 MB", () => {
    expect(checkFile("agent.py", MAX_BYTES + 1)).toBe("That file is over 1 MB.");
  });
  it("refuses an empty file", () => {
    expect(checkFile("agent.py", 0)).toBe("That file is empty.");
  });
  it("refuses other extensions", () => {
    expect(checkFile("agent.txt", 10)).toBe("Choose a .py file.");
    expect(checkFile("agent.py.zip", 10)).toBe("Choose a .py file.");
  });
});

describe("isUtf8", () => {
  it("accepts source text", () => {
    expect(isUtf8(new TextEncoder().encode("class Agent:\n    pass  # é\n"))).toBe(true);
  });
  it("refuses binary data", () => {
    expect(isUtf8(new Uint8Array([0xff, 0xfe, 0x00, 0x81]))).toBe(false);
  });
});

describe("waitText", () => {
  it("reads minutes and seconds", () => {
    expect(waitText("Please wait 00:07:12 before submitting again")).toBe("7 min 12 s");
  });
  it("folds hours into minutes", () => {
    expect(waitText("Please wait 01:02:03 before submitting again")).toBe("62 min 3 s");
  });
  it("drops zero parts", () => {
    expect(waitText("Please wait 00:10:00 before submitting again")).toBe("10 min");
    expect(waitText("Please wait 00:00:09 before submitting again")).toBe("9 s");
  });
  it("returns null when there is no time", () => {
    expect(waitText("Please wait a bit")).toBeNull();
  });
});

describe("uploadErrorMessage", () => {
  it("maps the database's refusal codes", () => {
    expect(uploadErrorMessage("PS001", "Submissions are closed")).toBe("Submissions are closed for this season.");
    expect(uploadErrorMessage("PS003", "This bot is banned")).toBe("This bot is banned. Contact the organisers.");
    expect(uploadErrorMessage("PS004", "Please wait 00:07:12 before submitting again"))
      .toBe("You can upload again in 7 min 12 s.");
  });
  it("still makes sense if the cooldown message changes", () => {
    expect(uploadErrorMessage("PS004", "slow down")).toBe("You uploaded recently. Try again in a few minutes.");
  });
  it("hides anything else behind a generic message", () => {
    expect(uploadErrorMessage("PS002", "No bot for this user")).toBe(GENERIC_UPLOAD_ERROR);
    expect(uploadErrorMessage("23505", 'duplicate key value violates unique constraint "x"')).toBe(GENERIC_UPLOAD_ERROR);
    expect(uploadErrorMessage(undefined, "fetch failed")).toBe(GENERIC_UPLOAD_ERROR);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: FAIL, cannot resolve `@/lib/upload-rules`.

- [ ] **Step 3: Implement the rules**

`web/lib/upload-rules.ts`:

```ts
// Upload checks shared by the browser (before sending) and the server.
export const MAX_BYTES = 1_048_576;
export const GENERIC_UPLOAD_ERROR = "Upload failed, please try again.";

export function checkFile(name: string, size: number): string | null {
  if (!name.toLowerCase().endsWith(".py")) return "Choose a .py file.";
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

// api_create_submission's cooldown error says "Please wait HH:MM:SS before ...".
export function waitText(message: string): string | null {
  const m = /(\d+):(\d{2}):(\d{2})/.exec(message);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  const seconds = Number(m[3]);
  if (minutes && seconds) return `${minutes} min ${seconds} s`;
  return minutes ? `${minutes} min` : `${seconds} s`;
}

export function uploadErrorMessage(code: string | undefined, message: string): string {
  switch (code) {
    case "PS001":
      return "Submissions are closed for this season.";
    case "PS003":
      return "This bot is banned. Contact the organisers.";
    case "PS004": {
      const wait = waitText(message);
      return wait ? `You can upload again in ${wait}.` : "You uploaded recently. Try again in a few minutes.";
    }
    default:
      return GENERIC_UPLOAD_ERROR;
  }
}
```

- [ ] **Step 4: Run the unit tests to see them pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write the failing integration tests**

`web/lib/upload.int.test.ts`:

```ts
// Runs against the local Supabase stack (supabase start). Creates throwaway
// users through the admin API and removes them afterwards.
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { createSubmission } from "@/lib/upload";

try {
  process.loadEnvFile(".env.local");
} catch {
  // CI passes the variables directly
}

const admin = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const SOURCE = new TextEncoder().encode("class Agent:\n    def act(self, obs):\n        return 0\n");
const users: string[] = [];
const stored: string[] = [];

async function newPlayer() {
  const email = `upload-test-${crypto.randomUUID().slice(0, 8)}@iiitdmj.ac.in`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  users.push(data.user.id);
  const { data: bot, error: botError } = await admin.from("bots").select("id").eq("owner_id", data.user.id).single();
  if (botError) throw botError;
  return { userId: data.user.id, botId: bot.id };
}

async function filesOf(botId: string) {
  const { data, error } = await admin.storage.from("agents").list(botId);
  if (error) throw error;
  return data.map((f) => f.name);
}

afterAll(async () => {
  await admin.from("season").update({ frozen: false }).eq("id", 1);
  if (stored.length) await admin.storage.from("agents").remove(stored);
  for (const id of users) await admin.auth.admin.deleteUser(id);
});

describe("createSubmission", () => {
  it("stores the file, records the submission and queues validation", async () => {
    const { userId, botId } = await newPlayer();
    const result = await createSubmission(admin, userId, { name: "agent.py", bytes: SOURCE });
    expect(result).toEqual({ ok: true, version: 1 });

    const { data: sub } = await admin
      .from("submissions").select("id, storage_path, sha256, size_bytes, status").eq("bot_id", botId).single();
    stored.push(sub!.storage_path!);
    expect(sub!.storage_path).toBe(`${botId}/${sub!.id}.py`);
    expect(sub!.status).toBe("pending");
    expect(sub!.size_bytes).toBe(SOURCE.byteLength);
    expect(sub!.sha256).toMatch(/^[0-9a-f]{64}$/);

    const { data: file } = await admin.storage.from("agents").download(sub!.storage_path!);
    expect(new Uint8Array(await file!.arrayBuffer())).toEqual(SOURCE);

    const { data: jobs } = await admin.from("jobs").select("kind").eq("submission_id", sub!.id);
    expect(jobs).toEqual([{ kind: "validate" }]);
  });

  it("refuses a second upload inside the cooldown and deletes its file", async () => {
    const { userId, botId } = await newPlayer();
    const first = await createSubmission(admin, userId, { name: "agent.py", bytes: SOURCE });
    expect(first.ok).toBe(true);
    const [kept] = await filesOf(botId);
    stored.push(`${botId}/${kept}`);

    const second = await createSubmission(admin, userId, { name: "agent.py", bytes: SOURCE });
    expect(second).toEqual({ ok: false, message: expect.stringMatching(/^You can upload again in .+\.$/) });
    expect(await filesOf(botId)).toEqual([kept]);
  });

  it("refuses uploads while the season is frozen and leaves nothing behind", async () => {
    const { userId, botId } = await newPlayer();
    await admin.from("season").update({ frozen: true }).eq("id", 1);
    try {
      const result = await createSubmission(admin, userId, { name: "agent.py", bytes: SOURCE });
      expect(result).toEqual({ ok: false, message: "Submissions are closed for this season." });
      expect(await filesOf(botId)).toEqual([]);
    } finally {
      await admin.from("season").update({ frozen: false }).eq("id", 1);
    }
  });

  it("refuses binary data before touching storage", async () => {
    const { userId, botId } = await newPlayer();
    const result = await createSubmission(admin, userId, { name: "agent.py", bytes: new Uint8Array([0xff, 0x00, 0x81]) });
    expect(result).toEqual({ ok: false, message: "That file isn't readable text. Upload the .py source file." });
    expect(await filesOf(botId)).toEqual([]);
  });
});
```

- [ ] **Step 6: Run them to see them fail**

Run: `npm run test:int`
Expected: FAIL, cannot resolve `@/lib/upload`.

The spec also listed "another user can't read the submission". That is already covered against the real database by `supabase/tests/database/04_access.test.sql` ("bob cannot see alice's submissions"), so it is not repeated here.

- [ ] **Step 7: Implement the upload and the admin client**

`web/lib/supabase/admin.ts`:

```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

// Secret key: bypasses row-level security. Only the upload path uses it.
export function createAdminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

`web/lib/upload.ts`:

```ts
// Server only: takes the admin client as an argument so tests can call it
// without a browser session. Flow from supabase/migrations/*_submissions_api.sql:
// upload the file, then api_create_submission; delete the file if refused.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { GENERIC_UPLOAD_ERROR, checkFile, isUtf8, uploadErrorMessage } from "@/lib/upload-rules";

export type UploadResult = { ok: true; version: number } | { ok: false; message: string };

const EXPECTED_REFUSALS = new Set(["PS001", "PS003", "PS004"]);

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSubmission(
  admin: SupabaseClient<Database>,
  userId: string,
  file: { name: string; bytes: Uint8Array },
): Promise<UploadResult> {
  const bad = checkFile(file.name, file.bytes.byteLength);
  if (bad) return { ok: false, message: bad };
  if (!isUtf8(file.bytes)) {
    return { ok: false, message: "That file isn't readable text. Upload the .py source file." };
  }

  const { data: bot, error: botError } = await admin.from("bots").select("id").eq("owner_id", userId).maybeSingle();
  if (botError || !bot) {
    console.error("upload: no bot for user", userId, botError);
    return { ok: false, message: GENERIC_UPLOAD_ERROR };
  }

  const submissionId = crypto.randomUUID();
  const path = `${bot.id}/${submissionId}.py`;
  const stored = await admin.storage
    .from("agents")
    .upload(path, file.bytes, { contentType: "text/x-python", upsert: false });
  if (stored.error) {
    console.error("upload: storage write failed", stored.error);
    return { ok: false, message: GENERIC_UPLOAD_ERROR };
  }

  const { data: submission, error } = await admin.rpc("api_create_submission", {
    p_user_id: userId,
    p_submission_id: submissionId,
    p_storage_path: path,
    p_sha256: await sha256Hex(file.bytes),
    p_size_bytes: file.bytes.byteLength,
  });
  if (error) {
    const removed = await admin.storage.from("agents").remove([path]);
    if (removed.error) console.error("upload: could not delete refused file", path, removed.error);
    if (!EXPECTED_REFUSALS.has(error.code)) console.error("upload: api_create_submission failed", error);
    return { ok: false, message: uploadErrorMessage(error.code, error.message) };
  }
  return { ok: true, version: submission.version };
}
```

- [ ] **Step 8: Run all tests**

Run: `npm test && npm run test:int`
Expected: PASS. If `createUser` fails with "Signups not allowed", Task 4's `enable_signup = false` is already applied and blocks the admin API; stop and report, because the seed script depends on the same call.

- [ ] **Step 9: Commit**

```bash
git add lib/
git commit -m "Add the upload path: checks, storage, api_create_submission and cleanup"
```

---

### Task 3: App shell, design tokens and Supabase clients

**Files:**
- Create: `web/proxy.ts`, `web/lib/supabase/server.ts`, `web/lib/supabase/browser.ts`, `web/lib/queries.ts`, `web/app/not-found.tsx`, `web/components/site-header.tsx`, `web/components/nav-links.tsx`, `web/components/site-footer.tsx`, `web/components/load-boundary.tsx`, `web/components/placeholder.tsx`, `web/components/live-refresh.tsx`, `web/components/next-round.tsx`, `web/components/swatch.tsx`
- Modify: `web/next.config.ts`, `web/app/globals.css` (replace), `web/app/layout.tsx` (replace), `web/app/page.tsx` (temporary placeholder, replaced in Task 5)

**Interfaces:**
- Consumes: `format.ts`, `colors.ts` (Task 1).
- Produces:
  - `supabase/server.ts`: `createClient(): Promise<SupabaseClient<Database>>`, `getUserId(): Promise<string | null>`
  - `supabase/browser.ts`: `createClient()` (browser)
  - `queries.ts`: `type Season = { name: string; frozen: boolean; engineHash: string | null; domain: string | null; cooldownMinutes: number }`, `getSeason(): Promise<Season>`, `getProfileHandle(userId: string): Promise<string | null>`, `check(what, res)` for list/`.single()` reads (throws on error or missing data), `checkMaybe(what, res)` for `.maybeSingle()` and count-only reads (throws only on error)
  - Components: `<LoadBoundary what="…" quiet?>`, `<Placeholder lines?>`, `<LiveRefresh table filter?>`, `<NextRound frozen>`, `<Swatch slot>`
  - CSS classes used by later tasks: `.wrap .stack .muted .small .mono .num .up .down .btn .btn-secondary .link-button .box .table .table-scroll .table-compact .crumbs .stats .stat .stat-label .stat-value .hero .hero-title .lede .actions .board .section-head .notice .error-text .placeholder .placeholder-line .seat .swatch .list-plain .pagination .prose`

- [ ] **Step 1: Configure Next.js**

`web/next.config.ts`: add `serverActions` inside the existing `experimental` block:

```ts
  experimental: {
    agentFeedback: true,
    // Uploads are capped at 1 MB by our own checks; the default 1 MB body
    // limit would refuse a 1 MB file plus form overhead before they run.
    serverActions: { bodySizeLimit: "2mb" },
  },
```

- [ ] **Step 2: Supabase clients and session refresh**

`web/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";

// Per request, with the visitor's session. Row-level security decides access.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components can't set cookies; proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}

export async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}
```

`web/lib/supabase/browser.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// Browser side: used only for Realtime subscriptions.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

`web/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Refreshes an expiring Supabase session before the page renders. Nothing else.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

`web/lib/queries.ts` (later tasks append to this file):

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { intervalMinutes } from "@/lib/format";

// Every read throws on failure so the nearest <LoadBoundary> shows
// "Couldn't load …". Details go to the server log only.
type Result<T> = { data: T | null; error: { message: string } | null };

function fail(what: string, error: unknown): never {
  console.error(`query failed: ${what}`, error);
  throw new Error(`Couldn't load ${what}`);
}

// For list and .single() reads: data must be there.
export function check<T>(what: string, res: Result<T>): T {
  if (res.error || res.data === null) fail(what, res.error ?? "no data");
  return res.data;
}

// For .maybeSingle() and count-only reads, where no data is a valid answer.
export function checkMaybe<T>(what: string, res: Result<T>): T | null {
  if (res.error) fail(what, res.error);
  return res.data;
}

export type Season = {
  name: string;
  frozen: boolean;
  engineHash: string | null;
  domain: string | null;
  cooldownMinutes: number;
};

export async function getSeason(): Promise<Season> {
  const supabase = await createClient();
  const row = check(
    "the season",
    await supabase
      .from("season")
      .select("name, frozen, engine_hash, allowed_email_domain, submission_cooldown")
      .eq("id", 1)
      .single(),
  );
  return {
    name: row.name,
    frozen: row.frozen,
    engineHash: row.engine_hash,
    domain: row.allowed_email_domain,
    cooldownMinutes: intervalMinutes(String(row.submission_cooldown)),
  };
}

export async function getProfileHandle(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const row = checkMaybe("your profile", await supabase.from("profiles").select("handle").eq("id", userId).maybeSingle());
  return row?.handle ?? null;
}
```

- [ ] **Step 3: Shared components**

`web/components/load-boundary.tsx`:

```tsx
"use client";

import { catchError, type ErrorInfo } from "next/error";

function Fallback({ what, quiet }: { what: string; quiet?: boolean }, { retry }: ErrorInfo) {
  if (quiet) return null;
  return (
    <p className="muted">
      Couldn&apos;t load {what}.{" "}
      <button type="button" className="link-button" onClick={() => retry()}>
        Try again
      </button>
    </p>
  );
}

export const LoadBoundary = catchError(Fallback);
```

`web/components/placeholder.tsx`:

```tsx
// Quiet stand-in while a section streams in: empty ruled rows, no animation.
export function Placeholder({ lines = 3 }: { lines?: number }) {
  return (
    <div className="placeholder" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="placeholder-line" />
      ))}
    </div>
  );
}
```

`web/components/live-refresh.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";

type LiveTable = "bots" | "submissions" | "matches";

// Re-renders the page's server data when rows change. If the connection
// drops nothing is shown; a reload or reconnect catches up.
export function LiveRefresh({ table, filter }: { table: LiveTable; filter?: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`live:${table}:${filter ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [table, filter, router]);
  return null;
}
```

`web/components/next-round.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { minutesUntil, nextRoundAt } from "@/lib/format";

// Computed in the browser so a cached page never shows a stale countdown.
export function NextRound({ frozen }: { frozen: boolean }) {
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      setMinutes(minutesUntil(nextRoundAt(now), now));
    };
    tick();
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);
  if (frozen || minutes === null) return null;
  return <span>next round in {minutes} min</span>;
}
```

`web/components/swatch.tsx`:

```tsx
import { PLAYER_COLORS } from "@/lib/colors";

export function Swatch({ slot }: { slot: number }) {
  return <span className="swatch" style={{ background: PLAYER_COLORS[slot] }} aria-hidden="true" />;
}
```

`web/components/nav-links.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/matches", label: "Matches" },
  { href: "/getting-started", label: "Getting started" },
];

export function NavLinks() {
  const path = usePathname();
  return LINKS.map(({ href, label }) => (
    <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}>
      {label}
    </Link>
  ));
}
```

`web/components/site-header.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { NavLinks } from "@/components/nav-links";
import { getProfileHandle } from "@/lib/queries";
import { getUserId } from "@/lib/supabase/server";

async function AccountLink() {
  const userId = await getUserId();
  if (!userId) return <Link href="/sign-in">Sign in</Link>;
  const handle = await getProfileHandle(userId);
  return <Link href="/me">{handle ?? "Your bot"}</Link>;
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">
          Papersseum
        </Link>
        <nav className="nav">
          <NavLinks />
          <span className="account">
            <Suspense fallback={null}>
              <AccountLink />
            </Suspense>
          </span>
        </nav>
      </div>
    </header>
  );
}
```

`web/components/site-footer.tsx`:

```tsx
import { Suspense } from "react";
import { LoadBoundary } from "@/components/load-boundary";
import { getSeason } from "@/lib/queries";

async function FooterContent() {
  const season = await getSeason();
  return (
    <>
      <span>{season.name}</span>
      {season.engineHash && <span className="mono">engine {season.engineHash}</span>}
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <LoadBoundary what="the season" quiet>
          <Suspense fallback={null}>
            <FooterContent />
          </Suspense>
        </LoadBoundary>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Layout, not-found and styles**

`web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Papersseum", template: "%s · Papersseum" },
  description: "A season-long bot tournament for IIITDM Jabalpur. Write a Python agent and climb the ladder.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        <main className="wrap">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
```

`web/app/not-found.tsx`:

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Not found</h1>
      <p className="muted">There&apos;s nothing at this address.</p>
      <p>
        <Link href="/">Back to the home page</Link>
      </p>
    </div>
  );
}
```

Temporary `web/app/page.tsx` (Task 5 replaces it):

```tsx
export default function Home() {
  return <h1>Papersseum</h1>;
}
```

`web/app/globals.css` (complete; later tasks only use these classes):

```css
@import "tailwindcss";

:root {
  color-scheme: light dark;
  --bg: #fafaf8;
  --surface: #ffffff;
  --text: #111111;
  --muted: #666666;
  --rule: #e4e4e0;
  --rule-soft: #efefeb;
  --up: #1f7a4d;
  --down: #b23b2a;
  --sans: var(--font-geist-sans), -apple-system, "Helvetica Neue", Arial, sans-serif;
  --mono: var(--font-geist-mono), ui-monospace, Menlo, monospace;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #121212;
    --surface: #181818;
    --text: #e8e8e6;
    --muted: #9a9a9a;
    --rule: #2a2a2a;
    --rule-soft: #222222;
    --up: #5cc98f;
    --down: #ef7d6b;
  }
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  font-size: 15px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.wrap { width: 100%; max-width: 960px; margin: 0 auto; padding: 0 16px; }
@media (min-width: 640px) { .wrap { padding: 0 28px; } }
main.wrap { flex: 1; padding-top: 36px; padding-bottom: 56px; }

h1 { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
h2 { font-size: 15px; font-weight: 600; margin: 40px 0 10px; }
main a { text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--rule); }
main a:hover { text-decoration-color: currentColor; }

.stack > * + * { margin-top: 12px; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.mono { font-family: var(--mono); font-size: 13px; }
.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.up { color: var(--up); }
.down { color: var(--down); }
.error-text { color: var(--down); }

/* header and footer */
.site-header { border-bottom: 1px solid var(--rule); }
.site-header .wrap { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 24px; padding-top: 14px; padding-bottom: 14px; }
.brand { font-weight: 600; letter-spacing: -0.01em; }
.nav { display: flex; flex-wrap: wrap; gap: 6px 20px; font-size: 14px; color: var(--muted); }
.nav a:hover, .nav a[aria-current="page"], .nav .account a { color: var(--text); }
.site-footer { border-top: 1px solid var(--rule); font-size: 13px; color: var(--muted); }
.site-footer .wrap { display: flex; flex-wrap: wrap; gap: 6px 20px; align-items: center; padding-top: 18px; padding-bottom: 24px; }

/* buttons */
.btn, .btn-secondary { display: inline-block; font-size: 14px; padding: 9px 15px; border-radius: 6px; cursor: pointer; text-decoration: none; line-height: 1.3; }
.btn { background: var(--text); color: var(--bg); border: 1px solid var(--text); }
.btn-secondary { background: var(--surface); color: var(--text); border: 1px solid var(--rule); }
main a.btn, main a.btn-secondary { text-decoration: none; }
.btn:disabled, .btn-secondary:disabled { opacity: 0.5; cursor: default; }
.link-button { background: none; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--rule); }
.link-button:hover { text-decoration-color: currentColor; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }

/* boxes and notices */
.box { background: var(--surface); border: 1px solid var(--rule); padding: 18px; }
.notice { border: 1px solid var(--rule); padding: 14px 16px; background: var(--surface); }

/* tables */
.table-scroll { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table th { font-weight: 400; color: var(--muted); font-size: 13px; text-align: left; padding: 8px 12px 8px 0; border-bottom: 1px solid var(--rule); white-space: nowrap; }
.table td { padding: 8px 12px 8px 0; border-bottom: 1px solid var(--rule-soft); vertical-align: top; }
.table th.num, .table td.num { text-align: right; }
.table th:last-child, .table td:last-child { padding-right: 0; }
.list-plain { list-style: none; padding: 0; margin: 4px 0 0; }

/* seats and swatches */
.swatch { display: inline-block; width: 9px; height: 9px; margin-right: 8px; border: 1px solid var(--rule); vertical-align: 0; }
.seat { white-space: nowrap; }
.seat + .seat::before { content: "·"; color: var(--muted); margin: 0 8px; }

/* stats row */
.stats { display: flex; flex-wrap: wrap; gap: 16px 44px; margin: 20px 0 8px; }
.stat-label { font-size: 13px; color: var(--muted); }
.stat-value { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }

/* page bits */
.crumbs { font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.section-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 4px 16px; margin-bottom: 14px; }
.pagination { display: flex; justify-content: space-between; margin-top: 16px; font-size: 14px; }

/* home */
.hero { display: grid; gap: 32px; align-items: center; padding: 12px 0 8px; }
@media (min-width: 800px) { .hero { grid-template-columns: 1.1fr 1fr; gap: 48px; } }
.hero-title { font-size: 40px; line-height: 1.05; letter-spacing: -0.03em; }
@media (min-width: 640px) { .hero-title { font-size: 46px; } }
.lede { font-size: 16px; color: var(--muted); max-width: 440px; margin: 18px 0 24px; }
.board { border: 1px solid var(--rule); background: var(--surface); padding: 10px; }
.board img { display: block; width: 100%; height: auto; }

/* placeholders */
.placeholder-line { height: 37px; border-bottom: 1px solid var(--rule-soft); }

/* long-form text */
.prose { max-width: 680px; }
.prose h2 { font-size: 18px; margin-top: 36px; }
.prose p, .prose ul, .prose pre { margin-top: 12px; }
.prose ul { padding-left: 20px; list-style: disc; }
.prose pre { font-family: var(--mono); font-size: 13px; background: var(--surface); border: 1px solid var(--rule); padding: 12px 14px; overflow-x: auto; }
.prose code { font-family: var(--mono); font-size: 13px; }

input[type="file"] { font: inherit; font-size: 14px; max-width: 100%; }
```

- [ ] **Step 5: Check it builds and renders**

Run: `npm run typecheck && npm run lint && npm test`
Expected: no errors.

Run `npm run dev`, open `http://127.0.0.1:3000/` and `http://127.0.0.1:3000/nope` in the browser pane.
Expected: header (Papersseum, three links, "Sign in"), heading, footer with "Season 1"; `/nope` shows "Not found". Check again with the colour scheme emulated as dark: dark background, light text. Check at 375 px wide: nav wraps under the brand, no sideways scroll.

- [ ] **Step 6: Commit**

```bash
git add next.config.ts proxy.ts app/ components/ lib/
git commit -m "Add the site shell: Paper styles, header, footer and Supabase clients"
```

---

### Task 4: Google sign-in

**Files:**
- Modify: `supabase/config.toml`, `web/components/site-footer.tsx`
- Create: `web/lib/auth-errors.ts`, `web/lib/auth-errors.test.ts`, `web/app/auth/actions.ts`, `web/app/auth/callback/route.ts`, `web/app/sign-in/page.tsx`, `web/components/submit-button.tsx`, `web/components/sign-in-button.tsx`

**Interfaces:**
- Consumes: `safeNext` (Task 1), `createClient`, `getUserId`, `getSeason` (Task 3).
- Produces: `signInWithGoogle(formData: FormData)`, `signOut()`, `<SignInButton next?>`, `<SubmitButton className? pendingText>`, `signInErrorKind(params: URLSearchParams)`, `signInErrorMessage(kind: string | undefined, domain: string | null)`

- [ ] **Step 1: Write the failing tests**

`web/lib/auth-errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signInErrorKind, signInErrorMessage } from "@/lib/auth-errors";

const params = (q: string) => new URLSearchParams(q);

describe("signInErrorKind", () => {
  it("is null for a normal return with a code", () => {
    expect(signInErrorKind(params("code=abc&next=/me"))).toBeNull();
  });
  it("spots the database refusing a non-college account", () => {
    expect(signInErrorKind(params("error=server_error&error_description=Database+error+saving+new+user"))).toBe("domain");
  });
  it("spots a cancelled Google prompt", () => {
    expect(signInErrorKind(params("error=access_denied&error_description=The+user+denied"))).toBe("cancelled");
  });
  it("treats a missing code as an expired link", () => {
    expect(signInErrorKind(params("next=/me"))).toBe("expired");
  });
  it("treats any other error as a failure", () => {
    expect(signInErrorKind(params("error=server_error&error_description=Something+else"))).toBe("failed");
  });
});

describe("signInErrorMessage", () => {
  it("names the allowed domain", () => {
    expect(signInErrorMessage("domain", "iiitdmj.ac.in")).toBe("Papersseum is only open to @iiitdmj.ac.in Google accounts.");
  });
  it("has a message for each kind and nothing for unknown values", () => {
    expect(signInErrorMessage("cancelled", null)).toBe("Sign-in was cancelled.");
    expect(signInErrorMessage("expired", null)).toBe("That sign-in link expired or was already used. Try again.");
    expect(signInErrorMessage("failed", null)).toBe("Sign-in failed. Try again.");
    expect(signInErrorMessage("<script>", null)).toBeNull();
    expect(signInErrorMessage(undefined, null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm test`
Expected: FAIL, cannot resolve `@/lib/auth-errors`.

- [ ] **Step 3: Implement the error mapping**

`web/lib/auth-errors.ts`:

```ts
export type SignInErrorKind = "domain" | "cancelled" | "expired" | "failed";

// Supabase hides the database's sign-up refusal behind this generic text.
const SIGNUP_REFUSED = /database error saving new user/i;

export function signInErrorKind(params: URLSearchParams): SignInErrorKind | null {
  const error = params.get("error");
  if (!error) return params.get("code") ? null : "expired";
  if (SIGNUP_REFUSED.test(params.get("error_description") ?? "")) return "domain";
  if (error === "access_denied") return "cancelled";
  return "failed";
}

export function signInErrorMessage(kind: string | undefined, domain: string | null): string | null {
  switch (kind) {
    case "domain":
      return domain ? `Papersseum is only open to @${domain} Google accounts.` : "This account can't sign up.";
    case "cancelled":
      return "Sign-in was cancelled.";
    case "expired":
      return "That sign-in link expired or was already used. Try again.";
    case "failed":
      return "Sign-in failed. Try again.";
    default:
      return null;
  }
}
```

Run: `npm test` → PASS.

- [ ] **Step 4: Enable Google in Supabase**

In `supabase/config.toml`:

1. In `[auth]`, change `additional_redirect_urls = ["https://127.0.0.1:3000"]` to:

```toml
additional_redirect_urls = ["http://127.0.0.1:3000/auth/callback", "http://localhost:3000/auth/callback"]
```

2. In `[auth.email]`, change `enable_signup = true` to `enable_signup = false` and put this comment on the line above it: `# Google is the only way to create an account (see web/specs/2026-10-13-web-app-design.md).`

3. Directly before the existing `[auth.external.apple]` section, add:

```toml
[auth.external.google]
enabled = true
# Values live in supabase/.env (git-ignored); see web/README.md.
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
redirect_uri = ""
url = ""
skip_nonce_check = false
```

Restart from the repo root and check the provider is on:

```bash
supabase stop && supabase start
curl -s http://127.0.0.1:54321/auth/v1/settings -H "apikey: $(supabase status -o env | sed -n 's/^PUBLISHABLE_KEY="\(.*\)"/\1/p')"
```

Expected: JSON with `"google":true` under `external`. Then re-run `npm run test:int` from `web/`: it must still pass, proving admin-created users (and therefore `worker/scripts/seed_local.py`) still work. If it fails with a sign-up error, stop and report.

- [ ] **Step 5: Server actions, callback and buttons**

`web/app/auth/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next")?.toString());
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://127.0.0.1:3000";
  const { data: season } = await supabase.from("season").select("allowed_email_domain").eq("id", 1).maybeSingle();
  const domain = season?.allowed_email_domain;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // hd only filters Google's account picker; the database enforces the domain.
      queryParams: { prompt: "select_account", ...(domain ? { hd: domain } : {}) },
    },
  });
  if (error || !data.url) {
    console.error("sign-in: could not start Google OAuth", error);
    redirect("/sign-in?error=failed");
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
```

`web/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { signInErrorKind } from "@/lib/auth-errors";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const kind = signInErrorKind(searchParams);
  if (kind) {
    if (kind !== "cancelled") console.error("auth callback:", Object.fromEntries(searchParams));
    return NextResponse.redirect(`${origin}/sign-in?error=${kind}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(searchParams.get("code")!);
  if (error) {
    console.error("auth callback: code exchange failed", error);
    return NextResponse.redirect(`${origin}/sign-in?error=expired`);
  }
  return NextResponse.redirect(`${origin}${safeNext(searchParams.get("next"))}`);
}
```

`web/components/submit-button.tsx`:

```tsx
"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingText,
  className = "btn",
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
```

`web/components/sign-in-button.tsx`:

```tsx
import { signInWithGoogle } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";

export function SignInButton({ next = "/me" }: { next?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton pendingText="Opening Google…">Sign in with Google</SubmitButton>
    </form>
  );
}
```

- [ ] **Step 6: Sign-in page and footer sign-out**

`web/app/sign-in/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInButton } from "@/components/sign-in-button";
import { signInErrorMessage } from "@/lib/auth-errors";
import { getSeason } from "@/lib/queries";
import { safeNext } from "@/lib/redirect";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

async function SignInPanel({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  if (await getUserId()) redirect(next);
  const season = await getSeason();
  const message = signInErrorMessage(typeof params.error === "string" ? params.error : undefined, season.domain);
  return (
    <div className="stack">
      {message && (
        <p className="error-text" role="alert">
          {message}
        </p>
      )}
      <SignInButton next={next} />
      {season.domain && <p className="muted small">Use your @{season.domain} Google account.</p>}
    </div>
  );
}

export default function SignInPage(props: PageProps<"/sign-in">) {
  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <Suspense fallback={null}>
        <SignInPanel searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
```

`web/components/site-footer.tsx`: replace `FooterContent` with:

```tsx
async function FooterContent() {
  const [season, userId] = await Promise.all([getSeason(), getUserId()]);
  return (
    <>
      <span>{season.name}</span>
      {season.engineHash && <span className="mono">engine {season.engineHash}</span>}
      {userId && (
        <form action={signOut}>
          <SubmitButton className="link-button" pendingText="Signing out…">
            Sign out
          </SubmitButton>
        </form>
      )}
    </>
  );
}
```

and add the imports:

```tsx
import { signOut } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { getUserId } from "@/lib/supabase/server";
```

- [ ] **Step 7: Verify by hand with real Google**

Run `npm run dev`. In a normal browser (Google blocks sign-in inside embedded panes), open `http://127.0.0.1:3000/sign-in`.

1. Click **Sign in with Google**, pick an `@iiitdmj.ac.in` test-user account. Expected: you land on `/me` (404 until Task 8; that is fine), the header shows your handle, and the footer shows **Sign out**.
2. Click **Sign out**. Expected: home page, header shows "Sign in".
3. Sign in with a non-college Google account that is a test user. Expected: `/sign-in` with "Papersseum is only open to @iiitdmj.ac.in Google accounts." If instead "Sign-in failed. Try again." shows, the dev server log line from `auth callback:` shows what Supabase actually sent; adjust `SIGNUP_REFUSED` and its test to match, then re-run `npm test`.
4. Open `http://127.0.0.1:3000/sign-in?error=<b>x</b>`. Expected: no message, just the button.

- [ ] **Step 8: Commit**

```bash
git add ../supabase/config.toml lib/ app/ components/
git commit -m "Add Google sign-in and turn off email sign-up"
```

---

### Task 5: Leaderboard and home page

**Files:**
- Create: `web/scripts/make_board.py`, `web/public/board-light.svg`, `web/public/board-dark.svg`, `web/components/leaderboard-table.tsx`, `web/components/match-list.tsx`, `web/app/leaderboard/page.tsx`
- Modify: `web/lib/queries.ts` (append), `web/app/page.tsx` (replace)

**Interfaces:**
- Consumes: `check`, `getSeason` (Task 3), `SignInButton` (Task 4), `format.ts`, `links.ts`, `Swatch`, `LoadBoundary`, `Placeholder`, `LiveRefresh`, `NextRound`.
- Produces:
  - `queries.ts`: `type LeaderRow = { rank: number; botId: string; name: string; owner: string | null; isHouse: boolean; rating: number; elo: number; sigma: number; games: number; version: number | null }`, `getLeaderboard(limit?: number): Promise<LeaderRow[]>`, `getLadderStats(): Promise<{ bots: number; matches: number }>`, `type SeatSummary = { slot: number; name: string | null; placement: number | null; crashed: boolean | null }`, `type MatchSummary = { id: number; roundId: number; status: MatchStatus; createdAt: string; finishedAt: string | null; seats: SeatSummary[] }`, `getMatches(opts: { page: number; pageSize: number }): Promise<{ matches: MatchSummary[]; hasMore: boolean }>`
  - `<LeaderboardTable limit? compact?>`, `<MatchList page? pageSize? compact?>`

- [ ] **Step 1: Generate the board images**

`web/scripts/make_board.py`:

```python
"""Render one real engine frame as light and dark SVGs for the home page.

    uv run --frozen python web/scripts/make_board.py web/public     (from the repo root)
"""
import sys
from pathlib import Path

from papersseum.agents import BASELINES
from papersseum.geometry import arena_mask
from papersseum.match import iter_frames, run_match

PLAYERS = ["#ff4d5e", "#4d9dff", "#35e07f", "#ffd23f", "#b36bff"]   # papersseum/render.py
THEMES = {
    "light": {"ground": "#efefec", "head": "#111111", "outline": "#ffffff"},
    "dark": {"ground": "#1f1f1f", "head": "#f5f5f5", "outline": "#111111"},
}
SEED, FRAME = 11, 1100


def svg(frame, mask, theme):
    h, w = frame["owner"].shape
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">']
    for r in range(h):
        c = 0
        while c < w:
            key = (frame["owner"][r, c], frame["trail"][r, c], mask[r, c])
            k = c
            while k < w and (frame["owner"][r, k], frame["trail"][r, k], mask[r, k]) == key:
                k += 1
            owner, trail, inside = key
            if inside:
                out.append(f'<rect x="{c}" y="{r}" width="{k - c}" height="1" fill="{theme["ground"]}"/>')
                if owner >= 0:
                    out.append(f'<rect x="{c}" y="{r}" width="{k - c}" height="1" fill="{PLAYERS[owner]}"/>')
                elif trail >= 0:
                    out.append(f'<rect x="{c}" y="{r}" width="{k - c}" height="1" fill="{PLAYERS[trail]}" opacity="0.45"/>')
            c = k
    for head in frame["heads"]:
        if head:
            out.append(f'<rect x="{head[1] - 1}" y="{head[0] - 1}" width="3" height="3" '
                       f'fill="{theme["head"]}" stroke="{theme["outline"]}" stroke-width="0.6"/>')
    out.append("</svg>")
    return "".join(out)


def main(out_dir):
    names = ["greedy", "safe_expander", "hunter", "greedy", "safe_expander"]
    result = run_match(SEED, [BASELINES[n]() for n in names])
    frame = list(iter_frames(SEED, result["action_log"]))[FRAME]
    mask = arena_mask()
    for name, theme in THEMES.items():
        Path(out_dir, f"board-{name}.svg").write_text(svg(frame, mask, theme))


if __name__ == "__main__":
    main(sys.argv[1])
```

Run from the repo root: `uv run --frozen python web/scripts/make_board.py web/public`
Expected: `web/public/board-light.svg` and `board-dark.svg`, each about 35 KB. Delete the scaffold's unused `web/public/*.svg` files other than these two (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`).

- [ ] **Step 2: Queries**

Append to `web/lib/queries.ts`:

```ts
import type { Database } from "@/lib/database.types";

export type MatchStatus = Database["public"]["Enums"]["match_status"];

export type LeaderRow = {
  rank: number;
  botId: string;
  name: string;
  owner: string | null;
  isHouse: boolean;
  rating: number;
  elo: number;
  sigma: number;
  games: number;
  version: number | null;
};

export async function getLeaderboard(limit?: number): Promise<LeaderRow[]> {
  const supabase = await createClient();
  let query = supabase.from("leaderboard").select("*").order("rank").order("name");
  if (limit) query = query.limit(limit);
  const rows = check("the leaderboard", await query);
  return rows.map((r) => ({
    rank: r.rank ?? 0,
    botId: r.bot_id!,
    name: r.name!,
    owner: r.is_house ? null : r.handle,
    isHouse: !!r.is_house,
    rating: r.conservative ?? 0,
    elo: r.elo ?? 0,
    sigma: r.sigma ?? 0,
    games: r.games ?? 0,
    version: r.active_version,
  }));
}

export async function getLadderStats(): Promise<{ bots: number; matches: number }> {
  const supabase = await createClient();
  const [bots, matches] = await Promise.all([
    supabase.from("leaderboard").select("bot_id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }).eq("status", "done"),
  ]);
  checkMaybe("ladder stats", bots);
  checkMaybe("ladder stats", matches);
  return { bots: bots.count ?? 0, matches: matches.count ?? 0 };
}

export type SeatSummary = { slot: number; name: string | null; placement: number | null; crashed: boolean | null };

export type MatchSummary = {
  id: number;
  roundId: number;
  status: MatchStatus;
  createdAt: string;
  finishedAt: string | null;
  seats: SeatSummary[];
};

export async function getMatches({ page, pageSize }: { page: number; pageSize: number }) {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const rows = check(
    "matches",
    await supabase
      .from("matches")
      .select("id, round_id, status, created_at, finished_at, match_players(slot, placement, crashed, bots(name))")
      .order("id", { ascending: false })
      .range(from, from + pageSize), // one extra row tells us whether there is another page
  );
  const matches: MatchSummary[] = rows.slice(0, pageSize).map((m) => ({
    id: m.id,
    roundId: m.round_id,
    status: m.status,
    createdAt: m.created_at,
    finishedAt: m.finished_at,
    seats: m.match_players
      .map((p) => ({ slot: p.slot, name: p.bots?.name ?? null, placement: p.placement, crashed: p.crashed }))
      .sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9) || a.slot - b.slot),
  }));
  return { matches, hasMore: rows.length > pageSize };
}
```

Move the new `import type { Database }` line to the top of the file with the other imports.

- [ ] **Step 3: Table components**

`web/components/leaderboard-table.tsx`:

```tsx
import Link from "next/link";
import { elo } from "@/lib/format";
import { botHref } from "@/lib/links";
import { getLeaderboard } from "@/lib/queries";

export async function LeaderboardTable({ limit, compact = false }: { limit?: number; compact?: boolean }) {
  const rows = await getLeaderboard(limit);
  if (rows.length === 0) return <p className="muted">No bots on the ladder yet.</p>;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Bot</th>
            {!compact && <th>Owner</th>}
            <th className="num">Rating</th>
            {!compact && <th className="num">Elo</th>}
            {!compact && <th className="num">±</th>}
            <th className="num">Games</th>
            {!compact && <th className="num">Version</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.botId}>
              <td>{r.rank}</td>
              <td>
                <Link href={botHref(r.name)}>{r.name}</Link>
              </td>
              {!compact && <td className="muted">{r.isHouse ? "house bot" : r.owner}</td>}
              <td className="num">
                <b>{elo(r.rating)}</b>
              </td>
              {!compact && <td className="num">{elo(r.elo)}</td>}
              {!compact && <td className="num muted">{elo(r.sigma)}</td>}
              <td className="num">{r.games}</td>
              {!compact && <td className="num muted">{r.version ? `v${r.version}` : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

`web/components/match-list.tsx`:

```tsx
import Link from "next/link";
import { Swatch } from "@/components/swatch";
import { MATCH_STATUS, clockTime, nextRoundAt, relativeTime } from "@/lib/format";
import { botHref, matchHref } from "@/lib/links";
import { getMatches, type SeatSummary } from "@/lib/queries";

function Seats({ seats }: { seats: SeatSummary[] }) {
  return seats.map((s) => (
    <span key={s.slot} className="seat">
      <Swatch slot={s.slot} />
      {s.name ? <Link href={botHref(s.name)}>{s.name}</Link> : <span className="muted">deleted bot</span>}
      {s.crashed && <span className="muted"> (crashed)</span>}
    </span>
  ));
}

export async function MatchList({ page = 1, pageSize = 50, compact = false }: { page?: number; pageSize?: number; compact?: boolean }) {
  const { matches, hasMore } = await getMatches({ page, pageSize });
  if (matches.length === 0) {
    return page === 1 ? (
      <p className="muted">No matches yet. The first round starts at {clockTime(nextRoundAt(Date.now()))}.</p>
    ) : (
      <p className="muted">
        No more matches. <Link href="/matches">Back to the newest</Link>
      </p>
    );
  }
  return (
    <>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 72 }}>Match</th>
              <th style={{ width: 110 }}>When</th>
              {!compact && <th style={{ width: 90 }}>Status</th>}
              <th>Finishing order</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={matchHref(m.id)}>{m.id}</Link>
                </td>
                <td className="muted">{relativeTime(m.finishedAt ?? m.createdAt)}</td>
                {!compact && <td className={m.status === "failed" ? "down" : undefined}>{MATCH_STATUS[m.status]}</td>}
                <td>
                  <Seats seats={m.seats} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && (page > 1 || hasMore) && (
        <div className="pagination">
          <span>{page > 1 && <Link href={page === 2 ? "/matches" : `/matches?page=${page - 1}`}>Newer</Link>}</span>
          <span>{hasMore && <Link href={`/matches?page=${page + 1}`}>Older</Link>}</span>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Pages**

`web/app/leaderboard/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { NextRound } from "@/components/next-round";
import { Placeholder } from "@/components/placeholder";
import { getSeason } from "@/lib/queries";

export const metadata: Metadata = { title: "Leaderboard" };

async function RoundClock() {
  const season = await getSeason();
  return <NextRound frozen={season.frozen} />;
}

export default function LeaderboardPage() {
  return (
    <>
      <div className="section-head">
        <div>
          <h1>Leaderboard</h1>
          <p className="muted small">
            Ranked by rating: Elo minus twice its uncertainty, so a bot with few games can&apos;t top the table by luck.
            Updates live.
          </p>
        </div>
        <span className="muted small">
          <Suspense fallback={null}>
            <RoundClock />
          </Suspense>
        </span>
      </div>
      <LoadBoundary what="the leaderboard">
        <Suspense fallback={<Placeholder lines={8} />}>
          <LeaderboardTable />
        </Suspense>
      </LoadBoundary>
      <LiveRefresh table="bots" />
    </>
  );
}
```

`web/app/page.tsx`:

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { MatchList } from "@/components/match-list";
import { NextRound } from "@/components/next-round";
import { Placeholder } from "@/components/placeholder";
import { SignInButton } from "@/components/sign-in-button";
import { getLadderStats, getSeason } from "@/lib/queries";
import { getUserId } from "@/lib/supabase/server";

async function SeasonLine() {
  const season = await getSeason();
  return <p className="muted small">{season.name} · IIITDM Jabalpur</p>;
}

async function HeroActions() {
  const signedIn = (await getUserId()) !== null;
  return (
    <div className="actions">
      {signedIn ? (
        <Link href="/me" className="btn">
          Upload a bot
        </Link>
      ) : (
        <SignInButton next="/me" />
      )}
      <Link href="/getting-started">Read the rules</Link>
    </div>
  );
}

async function HeroStats() {
  const [season, stats] = await Promise.all([getSeason(), getLadderStats()]);
  return (
    <p className="muted small" style={{ marginTop: 28 }}>
      {stats.bots} bots · {stats.matches.toLocaleString("en-IN")} matches played{" "}
      {!season.frozen && <>· <NextRound frozen={false} /></>}
    </p>
  );
}

export default function Home() {
  return (
    <>
      <section className="hero">
        <div>
          <LoadBoundary what="the season" quiet>
            <Suspense fallback={<p className="small">&nbsp;</p>}>
              <SeasonLine />
            </Suspense>
          </LoadBoundary>
          <h1 className="hero-title" style={{ marginTop: 14 }}>
            Write a bot.
            <br />
            Take the board.
          </h1>
          <p className="lede">
            Upload a Python agent. Every 15 minutes it plays territory capture against four others. Elo decides
            who&apos;s on top when the season ends.
          </p>
          <Suspense fallback={<div style={{ height: 40 }} />}>
            <HeroActions />
          </Suspense>
          <LoadBoundary what="ladder stats" quiet>
            <Suspense fallback={<p className="small" style={{ marginTop: 28 }}>&nbsp;</p>}>
              <HeroStats />
            </Suspense>
          </LoadBoundary>
        </div>
        <figure className="board">
          <picture>
            <source srcSet="/board-dark.svg" media="(prefers-color-scheme: dark)" />
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG with a dark-mode source */}
            <img src="/board-light.svg" alt="A Papersseum board mid-match: five players' territories in an arena" width={120} height={120} />
          </picture>
        </figure>
      </section>

      <h2>Top of the ladder</h2>
      <LoadBoundary what="the leaderboard">
        <Suspense fallback={<Placeholder lines={5} />}>
          <LeaderboardTable limit={5} compact />
        </Suspense>
      </LoadBoundary>
      <p className="small" style={{ marginTop: 10 }}>
        <Link href="/leaderboard">Full leaderboard</Link>
      </p>

      <h2>Latest matches</h2>
      <LoadBoundary what="matches">
        <Suspense fallback={<Placeholder lines={3} />}>
          <MatchList pageSize={3} compact />
        </Suspense>
      </LoadBoundary>
      <p className="small" style={{ marginTop: 10 }}>
        <Link href="/matches">All matches</Link>
      </p>

      <LiveRefresh table="bots" />
      <LiveRefresh table="matches" />
    </>
  );
}
```

- [ ] **Step 5: Prepare local data**

From the repo root, with Supabase running:

```bash
uv run --project worker --env-file worker/.env python worker/scripts/seed_local.py
```

Then start a worker in a second terminal (it runs only these known seed bots, so the unsandboxed local mode is acceptable here):

```bash
cd worker && SANDBOX_BACKEND=subprocess PAPERSSEUM_UNSAFE_LOCAL=1 uv run --env-file .env papersseum-worker
```

Wait until the log shows the six validations, then schedule a round:

```bash
uv run --project worker python -c "import psycopg; psycopg.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres', autocommit=True).execute('select internal.schedule_round()')"
```

Expected: the worker plays at least one match within a few minutes.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm test`
Expected: no errors.

With `npm run dev`, check in the browser pane:
- `/`: season line, headline, sign-in button, stats line with "next round in N min", board image, top 5, latest 3 matches with coloured squares.
- `/leaderboard`: all columns; house bots say "house bot".
- While on `/leaderboard`, run `select internal.schedule_round()` again; when the match finishes the table updates without a reload.
- Dark scheme: the board switches to the dark image. 375 px wide: the hero stacks, tables scroll inside themselves.
- Stop Supabase (`supabase stop`), reload `/`: "Couldn't load the leaderboard. Try again" in place, header and rest of the page still render. Start it again.

- [ ] **Step 7: Commit**

```bash
git add scripts/ public/ components/ app/ lib/
git commit -m "Add the home page and leaderboard"
```

---

### Task 6: Matches list and match page

**Files:**
- Create: `web/app/matches/page.tsx`, `web/app/matches/[id]/page.tsx`
- Modify: `web/lib/queries.ts` (append)

**Interfaces:**
- Consumes: `MatchList` (Task 5), `format.ts`, `links.ts`, `Swatch`, `LoadBoundary`, `Placeholder`, `LiveRefresh`.
- Produces: `queries.ts`: `type SeatResult = { slot: number; name: string | null; isHouse: boolean; placement: number | null; coverage: number | null; deaths: number | null; strikes: number | null; crashed: boolean | null; eloBefore: number | null; eloAfter: number | null }`, `type MatchDetail = { id: number; roundId: number; seed: number; status: MatchStatus; error: string | null; replayPath: string | null; createdAt: string; startedAt: string | null; finishedAt: string | null; seats: SeatResult[] }`, `getMatch(id: number): Promise<MatchDetail | null>`, `replayUrl(path: string): string`

- [ ] **Step 1: Queries**

Append to `web/lib/queries.ts`:

```ts
export type SeatResult = {
  slot: number;
  name: string | null;
  isHouse: boolean;
  placement: number | null;
  coverage: number | null;
  deaths: number | null;
  strikes: number | null;
  crashed: boolean | null;
  eloBefore: number | null;
  eloAfter: number | null;
};

export type MatchDetail = {
  id: number;
  roundId: number;
  seed: number;
  status: MatchStatus;
  error: string | null;
  replayPath: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  seats: SeatResult[];
};

export async function getMatch(id: number): Promise<MatchDetail | null> {
  const supabase = await createClient();
  const m = checkMaybe(
    "this match",
    await supabase
      .from("matches")
      .select(
        "id, round_id, seed, status, error, replay_path, created_at, started_at, finished_at, " +
          "match_players(slot, placement, coverage, deaths, strikes, crashed, elo_before, elo_after, bots(name, is_house))",
      )
      .eq("id", id)
      .maybeSingle(),
  );
  if (!m) return null;
  return {
    id: m.id,
    roundId: m.round_id,
    seed: Number(m.seed),
    status: m.status,
    error: m.error,
    replayPath: m.replay_path,
    createdAt: m.created_at,
    startedAt: m.started_at,
    finishedAt: m.finished_at,
    seats: m.match_players
      .map((p) => ({
        slot: p.slot,
        name: p.bots?.name ?? null,
        isHouse: !!p.bots?.is_house,
        placement: p.placement,
        coverage: p.coverage,
        deaths: p.deaths,
        strikes: p.strikes,
        crashed: p.crashed,
        eloBefore: p.elo_before,
        eloAfter: p.elo_after,
      }))
      .sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9) || a.slot - b.slot),
  };
}

export function replayUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/replays/${encodeURIComponent(path)}`;
}
```

If TypeScript cannot infer the row type from the concatenated select string, write the select as one string literal on a single line instead of concatenating.

- [ ] **Step 2: Matches list page**

`web/app/matches/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { MatchList } from "@/components/match-list";
import { Placeholder } from "@/components/placeholder";

export const metadata: Metadata = { title: "Matches" };

async function Page({ searchParams }: { searchParams: PageProps<"/matches">["searchParams"] }) {
  const raw = (await searchParams).page;
  const page = typeof raw === "string" && /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
  return <MatchList page={page} pageSize={50} />;
}

export default function MatchesPage(props: PageProps<"/matches">) {
  return (
    <>
      <h1 style={{ marginBottom: 14 }}>Matches</h1>
      <LoadBoundary what="matches">
        <Suspense fallback={<Placeholder lines={10} />}>
          <Page searchParams={props.searchParams} />
        </Suspense>
      </LoadBoundary>
      <LiveRefresh table="matches" />
    </>
  );
}
```

- [ ] **Step 3: Match page**

`web/app/matches/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { Swatch } from "@/components/swatch";
import { duration, elo, eloChange, percent, relativeTime, shortDateTime } from "@/lib/format";
import { botHref } from "@/lib/links";
import { getMatch, replayUrl, type MatchDetail, type SeatResult } from "@/lib/queries";

export const metadata: Metadata = { title: "Match" };

function BotName({ seat }: { seat: SeatResult }) {
  return (
    <>
      <Swatch slot={seat.slot} />
      {seat.name ? <Link href={botHref(seat.name)}>{seat.name}</Link> : <span className="muted">deleted bot</span>}
      {seat.isHouse && <span className="muted small"> house</span>}
    </>
  );
}

function EloCell({ seat }: { seat: SeatResult }) {
  const change = eloChange(seat.eloBefore, seat.eloAfter);
  if (!change) return <>—</>;
  return (
    <>
      {elo(seat.eloBefore)} → {elo(seat.eloAfter)}{" "}
      <span className={change.tone === "none" ? "muted" : change.tone}>{change.text}</span>
    </>
  );
}

function Results({ match }: { match: MatchDetail }) {
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 52 }}>Place</th>
            <th>Bot</th>
            <th className="num">Coverage</th>
            <th className="num">Deaths</th>
            <th className="num">Strikes</th>
            <th>Status</th>
            <th className="num">Elo</th>
          </tr>
        </thead>
        <tbody>
          {match.seats.map((s) => (
            <tr key={s.slot}>
              <td>{s.placement ?? "—"}</td>
              <td className="seat"><BotName seat={s} /></td>
              <td className="num">{percent(s.coverage)}</td>
              <td className="num">{s.deaths ?? "—"}</td>
              <td className="num">{s.strikes ?? "—"}</td>
              <td className={s.crashed ? undefined : "muted"}>{s.crashed ? "crashed" : "finished"}</td>
              <td className="num"><EloCell seat={s} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeatList({ match }: { match: MatchDetail }) {
  const bySlot = [...match.seats].sort((a, b) => a.slot - b.slot);
  return (
    <ul className="list-plain">
      {bySlot.map((s) => (
        <li key={s.slot} style={{ padding: "4px 0", whiteSpace: "nowrap" }}>
          <BotName seat={s} />
        </li>
      ))}
    </ul>
  );
}

async function MatchContent({ params }: { params: PageProps<"/matches/[id]">["params"] }) {
  const { id } = await params;
  if (!/^\d{1,15}$/.test(id)) notFound();
  const match = await getMatch(Number(id));
  if (!match) notFound();

  const when =
    match.finishedAt &&
    `finished ${shortDateTime(match.finishedAt)}, ${relativeTime(match.finishedAt)}` +
      (match.startedAt ? ` · took ${duration(match.startedAt, match.finishedAt)}` : "");

  return (
    <>
      <p className="crumbs">
        <Link href="/matches">Matches</Link> / {match.id}
      </p>
      <h1>Match {match.id}</h1>
      <p className="muted small" style={{ margin: "4px 0 20px" }}>
        Round {match.roundId}
        {when && ` · ${when}`} · seed <span className="mono">{match.seed}</span>
      </p>

      {match.status === "done" && (
        <>
          <Results match={match} />
          <div className="box actions" style={{ marginTop: 20, justifyContent: "space-between" }}>
            <span className="muted">The replay viewer isn&apos;t built yet.</span>
            {match.replayPath && (
              <span>
                <a href={replayUrl(match.replayPath)} download>
                  Download replay
                </a>{" "}
                <span className="muted small">
                  (.jsonl.gz, render it locally with <span className="mono">papersseum render</span>)
                </span>
              </span>
            )}
          </div>
        </>
      )}

      {(match.status === "queued" || match.status === "running") && (
        <>
          <p className="notice">This match hasn&apos;t finished yet.</p>
          <SeatList match={match} />
          <LiveRefresh table="matches" filter={`id=eq.${match.id}`} />
        </>
      )}

      {match.status === "failed" && (
        <>
          <p className="notice">
            This match couldn&apos;t be played{match.error ? `: ${match.error}` : "."}
          </p>
          <SeatList match={match} />
        </>
      )}
    </>
  );
}

export default function MatchPage(props: PageProps<"/matches/[id]">) {
  return (
    <LoadBoundary what="this match">
      <Suspense fallback={<Placeholder lines={7} />}>
        <MatchContent params={props.params} />
      </Suspense>
    </LoadBoundary>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test` → no errors.

In the browser pane:
- `/matches`: list with status column; if there are more than 50 matches, Older/Newer work.
- `/matches?page=abc` and `/matches?page=0`: shows page 1.
- `/matches/<a finished id>`: five seats with swatches, coverage, Elo before → after with green/red deltas, Download replay downloads a `.jsonl.gz`.
- `/matches/<an id still queued>` (run `select internal.schedule_round()` and open the newest match straight away): "hasn't finished yet", flips to results when the worker finishes.
- Make a failed match: from the repo root, `uv run --project worker python -c "import psycopg; psycopg.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres', autocommit=True).execute(\"update public.matches set status = 'failed', error = 'test failure' where id = (select max(id) from public.matches where status = 'queued')\")"`. Its page shows "This match couldn't be played: test failure", seats, no replay, and no "NaN" anywhere.
- `/matches/999999999` and `/matches/abc`: "Not found".

- [ ] **Step 5: Commit**

```bash
git add app/matches lib/queries.ts
git commit -m "Add the matches list and match page"
```

---

### Task 7: Bot profile

**Files:**
- Create: `web/app/bots/[name]/page.tsx`, `web/components/elo-line.tsx`
- Modify: `web/lib/queries.ts` (append)

**Interfaces:**
- Consumes: `eloLinePoints` (Task 1), `format.ts`, `links.ts`, `LoadBoundary`, `Placeholder`, `LiveRefresh`.
- Produces: `queries.ts`: `type BotProfile = { id: string; name: string; owner: string | null; isHouse: boolean; banned: boolean; elo: number; games: number; activeVersion: number | null; activeSince: string | null; rank: number | null; rating: number | null; sigma: number | null }`, `getBot(name: string): Promise<BotProfile | null>`, `type HistoryRow = { matchId: number; finishedAt: string | null; placement: number | null; coverage: number | null; eloBefore: number | null; eloAfter: number | null }`, `getBotHistory(botId: string, limit: number): Promise<HistoryRow[]>`; `<EloLine values={number[]}>`

- [ ] **Step 1: Queries**

Append to `web/lib/queries.ts`:

```ts
export type BotProfile = {
  id: string;
  name: string;
  owner: string | null;
  isHouse: boolean;
  banned: boolean;
  elo: number;
  games: number;
  activeVersion: number | null;
  activeSince: string | null;
  rank: number | null;
  rating: number | null;
  sigma: number | null;
};

export async function getBot(name: string): Promise<BotProfile | null> {
  const supabase = await createClient();
  const bot = checkMaybe(
    "this bot",
    await supabase
      .from("bots")
      .select("id, name, is_house, banned, elo, games, active_version, active_since, profiles(handle)")
      .eq("name", name)
      .maybeSingle(),
  );
  if (!bot) return null;
  const ladder = checkMaybe(
    "this bot's rank",
    await supabase.from("leaderboard").select("rank, conservative, sigma").eq("bot_id", bot.id).maybeSingle(),
  );
  return {
    id: bot.id,
    name: bot.name,
    owner: bot.profiles?.handle ?? null,
    isHouse: bot.is_house,
    banned: bot.banned,
    elo: bot.elo,
    games: bot.games,
    activeVersion: bot.active_version,
    activeSince: bot.active_since,
    rank: ladder?.rank ?? null,
    rating: ladder?.conservative ?? null,
    sigma: ladder?.sigma ?? null,
  };
}

export type HistoryRow = {
  matchId: number;
  finishedAt: string | null;
  placement: number | null;
  coverage: number | null;
  eloBefore: number | null;
  eloAfter: number | null;
};

// Newest first.
export async function getBotHistory(botId: string, limit: number): Promise<HistoryRow[]> {
  const supabase = await createClient();
  const rows = check(
    "this bot's matches",
    await supabase
      .from("match_players")
      .select("match_id, placement, coverage, elo_before, elo_after, matches!inner(status, finished_at)")
      .eq("bot_id", botId)
      .eq("matches.status", "done")
      .order("match_id", { ascending: false })
      .limit(limit),
  );
  return rows.map((r) => ({
    matchId: r.match_id,
    finishedAt: r.matches.finished_at,
    placement: r.placement,
    coverage: r.coverage,
    eloBefore: r.elo_before,
    eloAfter: r.elo_after,
  }));
}
```

- [ ] **Step 2: Elo line**

`web/components/elo-line.tsx`:

```tsx
import { elo } from "@/lib/format";
import { eloLinePoints } from "@/lib/elo-line";

const W = 600;
const H = 120;

export function EloLine({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="muted small">No rated matches yet.</p>;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`Elo from ${elo(values[0])} to ${elo(values[values.length - 1])}`}
        style={{ width: "100%", height: H, display: "block", borderBottom: "1px solid var(--rule)" }}>
        <polyline fill="none" stroke="var(--text)" strokeWidth="1.5" vectorEffect="non-scaling-stroke"
          points={eloLinePoints(values, W, H, 8)} />
      </svg>
      <figcaption className="muted small" style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span>low {elo(min)}</span>
        <span>high {elo(max)}</span>
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 3: Page**

`web/app/bots/[name]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EloLine } from "@/components/elo-line";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { elo, eloChange, percent, relativeTime, shortDate } from "@/lib/format";
import { matchHref } from "@/lib/links";
import { getBot, getBotHistory } from "@/lib/queries";

export const metadata: Metadata = { title: "Bot" };

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

async function BotContent({ params }: { params: PageProps<"/bots/[name]">["params"] }) {
  const name = decodeURIComponent((await params).name);
  const bot = await getBot(name);
  if (!bot) notFound();
  const history = await getBotHistory(bot.id, 100);

  const chronological = [...history].reverse();
  const series = chronological.length
    ? [chronological[0].eloBefore, ...chronological.map((h) => h.eloAfter)].filter((v): v is number => v !== null)
    : [];

  return (
    <>
      <h1>{bot.name}</h1>
      <p className="muted small" style={{ marginTop: 4 }}>
        {bot.isHouse ? "House bot" : `Owned by ${bot.owner ?? "a deleted account"}`}
        {bot.activeVersion && bot.activeSince && ` · version ${bot.activeVersion}, active since ${shortDate(bot.activeSince)}`}
      </p>
      {bot.banned && <p className="notice" style={{ marginTop: 16 }}>This bot is banned.</p>}

      <div className="stats">
        <Stat label="Rank" value={bot.rank ?? "—"} />
        <Stat label="Rating" value={elo(bot.rating)} />
        <Stat
          label="Elo"
          value={
            <>
              {elo(bot.elo)}{" "}
              {bot.sigma !== null && <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>± {elo(bot.sigma)}</span>}
            </>
          }
        />
        <Stat label="Games" value={bot.games} />
      </div>

      <h2>Elo over the last {Math.min(history.length, 100)} matches</h2>
      <EloLine values={series} />

      <h2>Recent matches</h2>
      {history.length === 0 ? (
        <p className="muted">No matches yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Match</th>
                <th>When</th>
                <th className="num">Place</th>
                <th className="num">Coverage</th>
                <th className="num">Elo change</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 15).map((h) => {
                const change = eloChange(h.eloBefore, h.eloAfter);
                return (
                  <tr key={h.matchId}>
                    <td><Link href={matchHref(h.matchId)}>{h.matchId}</Link></td>
                    <td className="muted">{h.finishedAt ? relativeTime(h.finishedAt) : "—"}</td>
                    <td className="num">{h.placement ?? "—"}</td>
                    <td className="num">{percent(h.coverage)}</td>
                    <td className={`num ${change && change.tone !== "none" ? change.tone : "muted"}`}>{change?.text ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <LiveRefresh table="bots" filter={`id=eq.${bot.id}`} />
    </>
  );
}

export default function BotPage(props: PageProps<"/bots/[name]">) {
  return (
    <LoadBoundary what="this bot">
      <Suspense fallback={<Placeholder lines={8} />}>
        <BotContent params={props.params} />
      </Suspense>
    </LoadBoundary>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test` → no errors.

In the browser pane: open a seeded bot from the leaderboard (`/bots/greedy1`), a house bot (`/bots/greedy`), and `/bots/nobody` (Not found). Check the line goes up when the bot won, the recent-matches deltas match the match pages, and a bot with no matches says "No rated matches yet." / "No matches yet." Ban one seeded bot (`update public.bots set banned = true where name = 'safe2'` via the same `psycopg` one-liner as Task 6) and check its page says "This bot is banned." and its rank shows "—"; then unban it.

- [ ] **Step 5: Commit**

```bash
git add app/bots components/elo-line.tsx lib/queries.ts
git commit -m "Add the bot profile page"
```

---

### Task 8: My bot page and upload

**Files:**
- Create: `web/app/me/page.tsx`, `web/app/me/actions.ts`, `web/app/me/upload-form.tsx`
- Modify: `web/lib/queries.ts` (append)

**Interfaces:**
- Consumes: `createSubmission`, `UploadResult` (Task 2), `checkFile`, `MAX_BYTES` (Task 2), `createAdminClient` (Task 2), `getUserId`, `getSeason` (Task 3), `SUBMISSION_STATUS`, `shortDateTime` (Task 1).
- Produces: `queries.ts`: `type MyBot = { id: string; name: string; banned: boolean; activeVersion: number | null; rank: number | null }`, `getMyBot(userId: string): Promise<MyBot | null>`, `type Violation = { line: number; kind: string; detail: string }`, `type MySubmission = { id: string; version: number; status: SubmissionStatus; error: string | null; violations: Violation[]; createdAt: string }`, `getMySubmissions(botId: string): Promise<MySubmission[]>`; `uploadBot(prev: UploadState, formData: FormData): Promise<UploadState>` with `type UploadState = { ok: boolean; message: string | null }`

- [ ] **Step 1: Queries**

Append to `web/lib/queries.ts` (and add `SubmissionStatus` next to `MatchStatus`):

```ts
export type SubmissionStatus = Database["public"]["Enums"]["submission_status"];

export type MyBot = { id: string; name: string; banned: boolean; activeVersion: number | null; rank: number | null };

export async function getMyBot(userId: string): Promise<MyBot | null> {
  const supabase = await createClient();
  const bot = checkMaybe(
    "your bot",
    await supabase.from("bots").select("id, name, banned, active_version").eq("owner_id", userId).maybeSingle(),
  );
  if (!bot) return null;
  const ladder = checkMaybe(
    "your rank",
    await supabase.from("leaderboard").select("rank").eq("bot_id", bot.id).maybeSingle(),
  );
  return { id: bot.id, name: bot.name, banned: bot.banned, activeVersion: bot.active_version, rank: ladder?.rank ?? null };
}

export type Violation = { line: number; kind: string; detail: string };

export type MySubmission = {
  id: string;
  version: number;
  status: SubmissionStatus;
  error: string | null;
  violations: Violation[];
  createdAt: string;
};

// Row-level security returns only the signed-in user's own submissions.
export async function getMySubmissions(botId: string): Promise<MySubmission[]> {
  const supabase = await createClient();
  const rows = check(
    "your uploads",
    await supabase
      .from("submissions")
      .select("id, version, status, error, violations, created_at")
      .eq("bot_id", botId)
      .order("version", { ascending: false })
      .limit(50),
  );
  return rows.map((s) => ({
    id: s.id,
    version: s.version,
    status: s.status,
    error: s.error,
    violations: Array.isArray(s.violations) ? (s.violations as Violation[]) : [],
    createdAt: s.created_at,
  }));
}
```

- [ ] **Step 2: Server action**

`web/app/me/actions.ts`:

```ts
"use server";

import { createSubmission } from "@/lib/upload";
import { checkFile } from "@/lib/upload-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserId } from "@/lib/supabase/server";

export type UploadState = { ok: boolean; message: string | null };

export async function uploadBot(_prev: UploadState, formData: FormData): Promise<UploadState> {
  const userId = await getUserId();
  if (!userId) return { ok: false, message: "Your session expired. Sign in again." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Choose a .py file." };
  const bad = checkFile(file.name, file.size); // before reading a large body into memory
  if (bad) return { ok: false, message: bad };

  const result = await createSubmission(createAdminClient(), userId, {
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
  });
  return result.ok
    ? { ok: true, message: `Version ${result.version} uploaded. It's being checked now.` }
    : { ok: false, message: result.message };
}
```

- [ ] **Step 3: Upload form**

`web/app/me/upload-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { uploadBot, type UploadState } from "@/app/me/actions";
import { checkFile } from "@/lib/upload-rules";

const INITIAL: UploadState = { ok: false, message: null };

export function UploadForm({ activeVersion, cooldownMinutes }: { activeVersion: number | null; cooldownMinutes: number }) {
  const [state, action, pending] = useActionState(uploadBot, INITIAL);
  const [fileError, setFileError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const message = fileError ?? state.message;
  const isError = fileError !== null || !state.ok;

  return (
    <form ref={formRef} action={action} className="box">
      <p style={{ fontWeight: 600 }}>Upload a new version</p>
      <p className="muted small" style={{ margin: "4px 0 14px" }}>
        One <span className="mono">.py</span> file, up to 1 MB. It&apos;s checked first; if it passes it
        {activeVersion ? ` replaces version ${activeVersion}` : " joins the ladder"}.
        {cooldownMinutes > 0 && ` One upload every ${cooldownMinutes} minutes.`} Test it locally first with{" "}
        <span className="mono">papersseum validate agent.py</span>.
      </p>
      <div className="actions">
        <input
          type="file"
          name="file"
          accept=".py,text/x-python"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFileError(f ? checkFile(f.name, f.size) : null);
          }}
        />
        <button type="submit" className="btn" disabled={pending || fileError !== null} style={{ marginLeft: "auto" }}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
      {message && (
        <p role="status" className={`small ${isError ? "error-text" : ""}`} style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Page**

`web/app/me/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UploadForm } from "@/app/me/upload-form";
import { LiveRefresh } from "@/components/live-refresh";
import { LoadBoundary } from "@/components/load-boundary";
import { Placeholder } from "@/components/placeholder";
import { SUBMISSION_STATUS, shortDateTime } from "@/lib/format";
import { botHref } from "@/lib/links";
import { getMyBot, getMySubmissions, getSeason, type MySubmission } from "@/lib/queries";
import { getUserId } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your bot" };

function Details({ sub }: { sub: MySubmission }) {
  switch (sub.status) {
    case "pending":
    case "validating":
      return <span className="muted small">running a test match, usually a few minutes</span>;
    case "active":
      return <span className="muted small">playing on the ladder</span>;
    case "superseded":
      return <span className="muted small">replaced by a newer version</span>;
    case "rejected": {
      const extra = sub.violations.map((v) => `line ${v.line}: ${v.detail}`).filter((t) => t !== sub.error);
      return (
        <>
          {sub.error && <div className="mono">{sub.error}</div>}
          {extra.length > 0 && (
            <ul className="list-plain mono">
              {extra.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
        </>
      );
    }
  }
}

async function MyBotContent() {
  const userId = await getUserId();
  if (!userId) redirect("/sign-in?next=/me");
  const [bot, season] = await Promise.all([getMyBot(userId), getSeason()]);
  if (!bot) {
    return <p className="muted">Your account has no bot. Contact the organisers.</p>;
  }
  const subs = await getMySubmissions(bot.id);

  return (
    <>
      <p className="muted small" style={{ margin: "4px 0 20px" }}>
        <Link href={botHref(bot.name)}>{bot.name}</Link>
        {bot.rank !== null && ` · rank ${bot.rank}`}
        {bot.activeVersion
          ? ` · version ${bot.activeVersion} is playing on the ladder`
          : " · no version is playing yet; upload one below"}
      </p>

      {bot.banned ? (
        <p className="notice">This bot is banned. Contact the organisers.</p>
      ) : season.frozen ? (
        <p className="notice">Submissions are closed for this season.</p>
      ) : (
        <UploadForm activeVersion={bot.activeVersion} cooldownMinutes={season.cooldownMinutes} />
      )}

      <h2>Versions</h2>
      {subs.length === 0 ? (
        <p className="muted">No uploads yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Version</th>
                <th style={{ width: 130 }}>Uploaded</th>
                <th style={{ width: 100 }}>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id}>
                  <td>v{s.version}</td>
                  <td className="muted">{shortDateTime(s.createdAt)}</td>
                  <td className={s.status === "rejected" ? "down" : s.status === "superseded" ? "muted" : undefined}>
                    {s.status === "active" ? <b>{SUBMISSION_STATUS[s.status]}</b> : SUBMISSION_STATUS[s.status]}
                  </td>
                  <td>
                    <Details sub={s} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LiveRefresh table="submissions" filter={`bot_id=eq.${bot.id}`} />
    </>
  );
}

export default function MePage() {
  return (
    <>
      <h1>Your bot</h1>
      <LoadBoundary what="your bot">
        <Suspense fallback={<Placeholder lines={6} />}>
          <MyBotContent />
        </Suspense>
      </LoadBoundary>
    </>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int` → no errors.

With the worker from Task 5 still running, in a normal browser signed in with Google:
1. Signed out, open `/me`: redirected to `/sign-in?next=/me`; after signing in you land on `/me`.
2. Upload `examples/my_agent.py` from the repo. Expected: "Version 1 uploaded…", a "Checking…" row, which turns "Active" without a reload once the worker validates it.
3. Upload again straight away. Expected: "You can upload again in 9 min …", no new row.
4. To skip the cooldown while testing: `update public.season set submission_cooldown = '0 seconds'` (psycopg one-liner from Task 6). Upload a file containing `import os` saved as `bad.py`. Expected: "Rejected" with `line 1: import 'os' is not allowed` in mono. Restore with `submission_cooldown = '10 minutes'`.
5. Pick a `.txt` file and a file over 1 MB (`head -c 1100000 /dev/zero > big.py`). Expected: the message appears immediately and Upload stays disabled.
6. `update public.season set frozen = true`: the form is replaced by "Submissions are closed for this season."; the leaderboard hides "next round". Set it back to `false`.
7. Dark scheme and 375 px width: the versions table scrolls inside itself.

- [ ] **Step 6: Commit**

```bash
git add app/me lib/queries.ts
git commit -m "Add the my-bot page with upload and live status"
```

---

### Task 9: Getting started page

**Files:**
- Create: `web/app/getting-started/page.tsx`

**Interfaces:**
- Consumes: `.prose` styles (Task 3).
- Produces: static page.

- [ ] **Step 1: Write the page**

`web/app/getting-started/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Getting started" };

export default function GettingStartedPage() {
  return (
    <article className="prose">
      <h1>Getting started</h1>
      <p className="muted">
        Five bots drop into a circular arena for 180 seconds. Leave your land and you draw a trail; close the loop and
        everything inside becomes yours. Cut a rival&apos;s trail and you take their land. Whoever owns the most of the
        map at the end wins.
      </p>

      <h2>1. Install the package</h2>
      <pre>pip install papersseum</pre>
      <p>
        Or from a clone of the repository: <code>pip install -e .</code>
      </p>

      <h2>2. Write an agent</h2>
      <pre>papersseum new my_agent.py</pre>
      <p>
        Your file defines a class named <code>Agent</code> with two methods:
      </p>
      <pre>{`class Agent:
    def reset(self, config: dict) -> None:
        """Called once per match with the constants and a seed."""

    def act(self, obs: dict) -> int:
        """Called every decision. Return 0 (straight), 1 (left) or 2 (right)."""`}</pre>
      <p>
        <code>obs</code> holds a global view <code>(16, 120, 120)</code>, a local view <code>(16, 31, 31)</code>{" "}
        rotated so your heading points up, and scalars such as your coverage, speed and time left. Use{" "}
        <code>papersseum.channels</code> for named channel indices.
      </p>

      <h2>3. Test it locally</h2>
      <pre>{`papersseum validate my_agent.py                 # the same checks the server runs
papersseum play my_agent.py --vs greedy,hunter --render match.mp4
papersseum eval my_agent.py --games 30           # placements, coverage and rating`}</pre>

      <h2>4. Limits</h2>
      <ul>
        <li>One <code>.py</code> file, up to 1 MB.</li>
        <li>
          <code>reset()</code> gets 2 seconds. Each <code>act()</code> gets 50 ms; a late or invalid answer plays
          straight.
        </li>
        <li>A bot that is late on more than 20% of its moves, or keeps a match waiting more than 20 seconds in total, is removed from that match.</li>
        <li>
          Allowed imports: numpy, math, random, itertools, collections, functools, heapq, bisect, typing,
          dataclasses, enum, json, copy, operator, statistics, array, re, string, time, abc, fractions, decimal,
          numbers, contextlib, papersseum and torch.
        </li>
        <li>
          <code>open</code>, <code>eval</code>, <code>exec</code>, <code>getattr</code>, <code>vars</code> and raw{" "}
          <code>numpy.load</code> / <code>torch.load</code> are blocked. Load weights with{" "}
          <code>papersseum.load_weights(config, &quot;policy.npy&quot;)</code> (<code>.npy</code>, <code>.npz</code>,{" "}
          <code>.pt</code>, <code>.pth</code>).
        </li>
      </ul>

      <h2>5. Upload</h2>
      <p>
        <Link href="/me">Sign in and upload</Link> your file. It plays a test match first; if it passes it joins the
        ladder and plays a match every 15 minutes. One upload every 10 minutes.
      </p>

      <h2>How ranking works</h2>
      <p>
        Every match updates each bot&apos;s Elo from where it placed. The leaderboard ranks by rating, which is Elo
        minus twice its uncertainty: the uncertainty shrinks as a bot plays more games, so a new bot can&apos;t top
        the table after a few lucky wins.
      </p>
    </article>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint` → no errors. Open `/getting-started` in light, dark and at 375 px: code blocks scroll inside themselves, the page does not.

- [ ] **Step 3: Commit**

```bash
git add app/getting-started
git commit -m "Add the getting started page"
```

---

### Task 10: CI, README and final check

**Files:**
- Modify: `.github/workflows/tests.yml`
- Replace: `web/README.md`

**Interfaces:**
- Consumes: npm scripts from Task 1.

- [ ] **Step 1: CI**

In `.github/workflows/tests.yml`, add a job after `worker`:

```yaml
  web:
    name: Web (types, lint, unit tests, build)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    env:
      # The build never contacts Supabase: every data read happens at request time.
      NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ci-placeholder
      SUPABASE_SECRET_KEY: ci-placeholder
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

In the existing `database` job, add a job-level `env` (Google is enabled in `config.toml`, which reads these):

```yaml
    env:
      SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: ci-placeholder
      SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: ci-placeholder
```

and these steps after "Security and performance advisors":

```yaml
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: web/package-lock.json
      - name: Web upload tests against local Supabase
        working-directory: web
        run: |
          npm ci
          eval "$(supabase status -o env | sed 's/^/export /')"
          NEXT_PUBLIC_SUPABASE_URL="$API_URL" SUPABASE_SECRET_KEY="$SECRET_KEY" npm run test:int
```

- [ ] **Step 2: README**

Replace `web/README.md` with:

````markdown
# Papersseum web

The website: leaderboard, matches, bot pages, uploads and Google sign-in.
Design: `specs/2026-10-13-web-app-design.md`.

## Run locally

1. Start Supabase from the repo root: `supabase start`.
2. Google sign-in (once):
   - In Google Cloud Console create an OAuth consent screen (External, testing
     mode; add your test accounts as test users) and a **Web application**
     OAuth client with these authorised redirect URIs:
     `http://127.0.0.1:54321/auth/v1/callback` and
     `http://localhost:54321/auth/v1/callback`.
   - Put the client's values in `supabase/.env` (git-ignored):
     ```
     SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
     SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
     ```
   - Restart Supabase: `supabase stop && supabase start`.
3. `web/.env.local` needs `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from
   `supabase status`. The secret key is used only by the upload code.
4. `npm install && npm run dev`, then open http://127.0.0.1:3000.

For data to look at, seed players and run a worker as described in
`worker/README.md`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests |
| `npm run test:int` | Upload tests against local Supabase (creates and deletes test users) |
| `npm run typecheck` | Generates route types, then `tsc` |
| `npm run lint` | ESLint |
| `npm run gen:types` | Regenerates `lib/database.types.ts` after a migration |
````

- [ ] **Step 3: Final check**

Run: `npm run typecheck && npm run lint && npm test && npm run test:int && npm run build`
Expected: all pass, and the build output lists every route.

Then walk every page once more in the browser pane in light, dark and at 375 px: `/`, `/leaderboard`, `/matches`, a match, a bot, `/me`, `/getting-started`, `/sign-in`, `/sign-in?error=domain`, a 404. Confirm: no gradients, no badges or icons, no sideways page scroll, no "NaN" or "undefined" anywhere.

- [ ] **Step 4: Commit**

```bash
git add ../.github/workflows/tests.yml README.md
git commit -m "Run web checks in CI and document local setup"
```
