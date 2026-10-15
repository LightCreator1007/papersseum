// rename_bot and set_active_submission are drafted as `returns table`, which supabase-js
// hands back as an array. A `returns <row type>` version would come back as one object.
// Accept either, so the callers don't break when the SQL settles on one.
export function firstRow<T>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}
