import { cookies } from "next/headers";

// Dev-only stand-in for Google sign-in, so the signed-in flows can be walked before auth
// and the database are wired up. A cookie names a persona; getUserId and the "my bot"
// queries then answer from lib/dev-fixtures.ts instead of Supabase. Nothing here runs in
// production: devAuthEnabled() is false there, so the cookie is ignored.

export const DEV_AUTH_COOKIE = "papersseum-dev-as";

export const DEV_PERSONAS = {
  newcomer: { label: "First sign-in, nothing uploaded", userId: "00000000-0000-4000-8000-00000000d001", name: "Riya Sen" },
  player: { label: "Player with a bot, 3 versions, a saved character", userId: "00000000-0000-4000-8000-00000000d002", name: "Ashutosh Kumar" },
  banned: { label: "Player whose bot is banned", userId: "00000000-0000-4000-8000-00000000d003", name: "Rule Bender" },
  organiser: { label: "Organiser, opens the admin panel", userId: "00000000-0000-4000-8000-00000000d004", name: "Season Organiser" },
} as const;

export type DevPersona = keyof typeof DEV_PERSONAS;

export const isDevPersona = (v: unknown): v is DevPersona => typeof v === "string" && Object.hasOwn(DEV_PERSONAS, v);

export const devAuthEnabled = () => process.env.NODE_ENV === "development";

export async function devPersona(): Promise<DevPersona | null> {
  if (!devAuthEnabled()) return null;
  const value = (await cookies()).get(DEV_AUTH_COOKIE)?.value;
  return isDevPersona(value) ? value : null;
}

export function personaForUser(userId: string): DevPersona | null {
  if (!devAuthEnabled()) return null;
  for (const [key, p] of Object.entries(DEV_PERSONAS)) if (p.userId === userId) return key as DevPersona;
  return null;
}
