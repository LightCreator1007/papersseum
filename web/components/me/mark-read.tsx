"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markNotificationsRead } from "@/features/upload/actions";
import { Button } from "@/components/ui/button";
import styles from "./me.module.css";

export function MarkRead({ ids }: { ids: number[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div style={{ marginTop: 16 }}>
      <Button
        variant="ghost"
        pending={pending}
        pendingLabel="Marking…"
        onClick={() =>
          start(async () => {
            const r = await markNotificationsRead(ids);
            if (r.ok) router.refresh();
            else setError(r.message);
          })
        }
      >
        Mark all as read
      </Button>
      {error && (
        <p className={styles.msg} data-ok="false" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
