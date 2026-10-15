// Owner names come from the Google account (profiles.display_name). Short spots,
// like the header's account link, use the first word.
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}
