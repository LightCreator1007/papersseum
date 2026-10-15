"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { banForm, freezeForm, requeueForm } from "@/app/admin/actions";
import type { ActionState } from "@/features/upload/actions";
import { botHref } from "@/features/ladder/links";
import { Button } from "@/components/ui/button";
import type { AdminBot } from "@/lib/server/admin";
import styles from "./admin.module.css";

type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

const ARM_MS = 4000;

// One button around one server action. With `confirm`, the first press arms it and asks
// again, so a stray click can't ban a bot or freeze the season.
function InlineAction({
  action,
  fields,
  label,
  confirm,
  pendingLabel,
  variant = "ghost",
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
  confirm?: string;
  pendingLabel: string;
  variant?: "ink" | "ghost";
}) {
  const [state, run, pending] = useActionState(action, { ok: true, message: "" });
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), ARM_MS);
    return () => window.clearTimeout(id);
  }, [armed]);

  return (
    <form
      action={run}
      className={styles.inline}
      onSubmit={(e) => {
        if (confirm && !armed) {
          e.preventDefault();
          setArmed(true);
          return;
        }
        setArmed(false);
      }}
    >
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Button type="submit" size="sm" variant={armed ? "ink" : variant} pending={pending} pendingLabel={pendingLabel}>
        {armed ? confirm : label}
      </Button>
      {state.message && (
        <span className={styles.msg} data-ok={state.ok} role={state.ok ? "status" : "alert"}>
          {state.reason === "unavailable" ? "Not switched on yet (database ask A12)." : state.message}
        </span>
      )}
    </form>
  );
}

export function FreezeToggle({ frozen }: { frozen: boolean }) {
  return frozen ? (
    <InlineAction action={freezeForm} fields={{ frozen: "false" }} label="Open uploads" pendingLabel="Opening…" variant="ink" />
  ) : (
    <InlineAction
      action={freezeForm}
      fields={{ frozen: "true" }}
      label="Freeze uploads"
      confirm="Freeze for everyone?"
      pendingLabel="Freezing…"
    />
  );
}

export function RetryJob({ id }: { id: number }) {
  return <InlineAction action={requeueForm} fields={{ job: String(id) }} label="Retry" pendingLabel="Queuing…" />;
}

export function BotsTable({ bots }: { bots: AdminBot[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? bots.filter((b) => b.name.toLowerCase().includes(q)) : bots;
  }, [bots, query]);

  return (
    <>
      <label className={styles.filter}>
        <span className="visually-hidden">Find a bot</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Find among ${bots.length} bots`}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {shown.length === 0 ? (
        <p className="muted small">No bot matches “{query.trim()}”.</p>
      ) : (
        <ul className={styles.rows}>
          {shown.map((b) => (
            <li key={b.id} data-banned={b.banned || undefined}>
              <div className={styles.who}>
                <Link href={botHref(b.name)} title={b.name}>
                  {b.name}
                </Link>
                {b.isHouse && <span className={styles.tag}>house</span>}
                {b.banned && <span className={styles.tag} data-tone="failed">banned</span>}
              </div>
              <span className={styles.meta}>
                {b.games === 0 ? "Not rated yet" : `${Math.round(b.elo ?? 0)} · ${b.games} games`}
                {" · "}
                {b.activeVersion === null ? "no passing version" : `v${b.activeVersion}`}
              </span>
              {b.banned ? (
                <InlineAction action={banForm} fields={{ bot: b.id, banned: "false" }} label="Unban" pendingLabel="Unbanning…" />
              ) : (
                <InlineAction
                  action={banForm}
                  fields={{ bot: b.id, banned: "true" }}
                  label="Ban"
                  confirm={`Ban ${b.name}?`}
                  pendingLabel="Banning…"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
