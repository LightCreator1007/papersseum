// A stand-in for the supabase-js query builder: every chained call is recorded, and each
// table answers with the next queued response, whether awaited directly or via maybeSingle.
type Response = { data?: unknown; error?: unknown; count?: number | null };

export type Call = { table: string; ops: [string, unknown[]][] };

export function fakeDb(responses: Record<string, Response[]>) {
  const calls: Call[] = [];
  const next = (table: string) => {
    const r = responses[table]?.shift() ?? {};
    return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
  };
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    calls.push(call);
    const builder: Record<string, unknown> = {};
    for (const op of ["select", "eq", "lt", "order", "limit"]) {
      builder[op] = (...args: unknown[]) => {
        call.ops.push([op, args]);
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve(next(table));
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(next(table)).then(resolve, reject);
    return builder;
  };
  return { from, calls };
}
