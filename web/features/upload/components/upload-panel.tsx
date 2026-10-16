import { ButtonLink } from "@/components/ui/button";
import type { MySubmission } from "@/features/ladder/queries";
import { STARTER_URL } from "@/features/upload/upload-rules";
import { cooldownLeft, type UploadView } from "@/features/upload/upload-view";
import { UploadForm } from "./upload-form";
import styles from "./upload-panel.module.css";

// The upload card on /me, at #upload so every "Upload" link lands on it. A first upload
// gets the two steps (starter, then upload); after that it's one drop zone whose copy
// says what the upload will replace.
export function UploadPanel({
  view,
  activeVersion,
  cooldownMinutes,
  now,
}: {
  view: UploadView<MySubmission>;
  activeVersion: number | null;
  cooldownMinutes: number;
  now: number;
}) {
  const form = (
    <UploadForm
      next={view.next}
      cooldownMinutes={cooldownMinutes}
      nextUploadAt={view.nextUploadAt}
      initialWaitMs={cooldownLeft(view.nextUploadAt, now)}
    />
  );

  if (view.next === 1) {
    return (
      <section id="upload" className={`box ${styles.panel}`} aria-labelledby="upload-title">
        <header className={styles.head}>
          <h2 id="upload-title" className={styles.title}>
            Get your bot on the ladder
          </h2>
          <p className="muted small">
            The starter plays as it is, so you can upload it now and improve it between rounds.
          </p>
        </header>
        <ol className={styles.steps}>
          <li>
            <span className={styles.n}>01</span>
            <div className={styles.step}>
              <b>Get the starter</b>
              <div className={styles.starter}>
                <ButtonLink href={STARTER_URL} download variant="ghost" size="sm">
                  Download my_agent.py
                </ButtonLink>
                <span className="muted small">
                  or run <code>papersseum new my_agent.py</code>
                </span>
              </div>
            </div>
          </li>
          <li>
            <span className={styles.n}>02</span>
            <div className={styles.step}>
              <b>Upload it</b>
              {form}
            </div>
          </li>
        </ol>
      </section>
    );
  }

  return (
    <section id="upload" className={`box ${styles.panel}`} aria-labelledby="upload-title">
      <header className={styles.head}>
        <h2 id="upload-title" className={styles.title}>
          {view.rejected ? "Upload a fix" : "Upload a new version"}
        </h2>
        <p className="muted small">
          {activeVersion
            ? `Replaces v${activeVersion} if it passes the check. You can switch back in Versions.`
            : "It joins the ladder if it passes the check."}
        </p>
      </header>
      {form}
    </section>
  );
}
