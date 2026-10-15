"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionState } from "@/features/upload/actions";
import { Button } from "@/components/ui/button";
import styles from "./me.module.css";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

// A small form around one server action, showing its outcome inline.
// "unavailable" means the database function isn't deployed yet.
export function ActionForm({ action, submit, children }: { action: Action; submit: string; children: ReactNode }) {
  const [state, run, pending] = useActionState(action, { ok: true, message: "" });
  return (
    <form action={run}>
      <div className={styles.row}>
        {children}
        <Button type="submit" pending={pending} pendingLabel="Saving…">
          {submit}
        </Button>
      </div>
      {state.message && (
        <p className={styles.msg} data-ok={state.ok} role={state.ok ? "status" : "alert"}>
          {state.reason === "unavailable" ? "This isn't switched on yet. The organisers are adding it." : state.message}
        </p>
      )}
    </form>
  );
}
