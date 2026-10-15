export type Reason = "unavailable" | "forbidden" | "invalid" | "conflict" | "error";
export type Fail = { ok: false; reason: Reason; message: string };
export type Result<T> = { ok: true; data: T } | Fail;

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (reason: Reason, message: string): Fail => ({ ok: false, reason, message });
