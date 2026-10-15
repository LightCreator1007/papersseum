import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { MarkRead } from "@/components/me/mark-read";
import styles from "@/components/me/me.module.css";
import { Placeholder } from "@/components/placeholder";
import { relativeTime } from "@/features/ladder/format";
import { requireMyBot } from "@/lib/me";
import { describeNotification } from "@/lib/notifications";
import { getNotifications } from "@/features/ladder/queries";

export const metadata: Metadata = { title: "Inbox" };

async function InboxContent() {
  await requireMyBot("/me/inbox");
  const { items, available, error } = await getNotifications();
  await connection(); // relativeTime reads the clock, so this must render per request

  if (!available) {
    return (
      <p className={styles.note}>
        The inbox isn&apos;t switched on yet. Until it is, upload results show on the overview.
      </p>
    );
  }
  if (error) return <p role="alert">{error}</p>;
  if (items.length === 0) {
    return <p className="muted">Nothing yet. You&apos;ll hear here when an upload passes or fails, and after your first match.</p>;
  }
  const unread = items.filter((n) => !n.readAt).map((n) => n.id);
  return (
    <>
      <ul className={styles.list}>
        {items.map((n) => {
          const d = describeNotification(n);
          return (
            <li key={n.id} data-read={!!n.readAt}>
              <span className={styles.dot} aria-hidden style={n.readAt ? { background: "transparent" } : undefined} />
              <div>
                <strong>
                  <Link href={d.href}>{d.title}</Link>
                </strong>
                <p>{d.body}</p>
              </div>
              <time dateTime={n.createdAt}>{relativeTime(n.createdAt)}</time>
            </li>
          );
        })}
      </ul>
      {unread.length > 0 && <MarkRead ids={unread} />}
    </>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<Placeholder lines={6} />}>
      <InboxContent />
    </Suspense>
  );
}
