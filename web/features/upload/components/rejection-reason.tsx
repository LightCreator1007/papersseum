import type { MySubmission } from "@/features/ladder/queries";
import { fixHints } from "@/features/upload/version-notes";
import styles from "./rejection-reason.module.css";

const MAX_VIOLATION_LINES = 20;

// Why a version was rejected and what to change: the checker's message, the lines it
// flagged, then one fix per kind of problem (version-notes.ts).
export function RejectionReason({ sub }: { sub: Pick<MySubmission, "error" | "violations"> }) {
  const extra = sub.violations.map((v) => `line ${v.line}: ${v.detail}`).filter((t) => t !== sub.error);
  if (!sub.error && extra.length === 0) return <p className={`muted small ${styles.none}`}>No reason was recorded.</p>;
  const hints = fixHints(sub.violations, sub.error);
  return (
    <div className={styles.reason}>
      {sub.error && (
        <p className={`mono ${styles.error}`}>
          {sub.error.startsWith("Validation could not run") ? "Validation could not run. Try uploading again." : sub.error}
        </p>
      )}
      {extra.length > 0 && (
        <ul className={`list-plain mono ${styles.lines}`}>
          {extra.slice(0, MAX_VIOLATION_LINES).map((t, i) => (
            <li key={`${i}:${t}`}>{t}</li>
          ))}
          {extra.length > MAX_VIOLATION_LINES && <li>and {extra.length - MAX_VIOLATION_LINES} more</li>}
        </ul>
      )}
      {hints.length > 0 && (
        <ul className={`list-plain small ${styles.hints}`}>
          {hints.map((h) => (
            <li key={h}>
              <span className={styles.fix}>Fix</span> {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
