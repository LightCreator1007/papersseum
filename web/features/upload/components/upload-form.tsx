"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { uploadBot, type UploadState } from "@/features/upload/actions";
import { NETWORK_ERROR, checkFile } from "@/features/upload/upload-rules";
import { useOnline } from "./use-online";
import styles from "./upload-form.module.css";

const INITIAL: UploadState = { ok: false, message: null };

// A dropped connection rejects the server action; say so here instead of throwing to the
// page's error boundary.
async function send(prev: UploadState, form: FormData): Promise<UploadState> {
  try {
    return await uploadBot(prev, form);
  } catch (e) {
    console.error("upload: request failed", e);
    return { ok: false, message: NETWORK_ERROR };
  }
}

const noop = () => () => {};

export function UploadForm({ activeVersion, cooldownMinutes }: { activeVersion: number | null; cooldownMinutes: number }) {
  const [state, run, pending] = useActionState(send, INITIAL);
  const [fileError, setFileError] = useState<string | null>(null);
  // The server's answer to the last upload, until a new file is picked.
  const [dismissed, setDismissed] = useState<UploadState | null>(null);
  // False in the server HTML and during hydration, true after, so the button stays
  // inert until the submit handler is attached.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const online = useOnline();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const blocked = !hydrated || !online || fileError !== null;

  // Submitting by hand rather than through the form action keeps the chosen file after a
  // refusal (React resets the form when an action runs), so a retry is one click.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending || blocked) return;
    const data = new FormData(e.currentTarget);
    startTransition(() => run(data));
  };

  const server = state === dismissed ? null : state;
  const message = fileError ?? server?.message ?? null;
  const isError = fileError !== null || server?.ok === false;

  return (
    <form ref={formRef} action={run} onSubmit={onSubmit} className="box">
      <p className={styles.title}>Upload a new version</p>
      <p className={`muted small ${styles.lede}`}>
        One <span className="mono">.py</span> file, up to 1 MB. It&apos;s checked first; if it passes it
        {activeVersion ? ` replaces version ${activeVersion}` : " joins the ladder"}.
        {cooldownMinutes > 0 && ` One upload every ${cooldownMinutes} minutes.`} Test it locally first with{" "}
        <span className="mono">papersseum validate agent.py</span>.
      </p>
      <div className={styles.row}>
        <input
          type="file"
          name="file"
          aria-label="Bot file (.py)"
          accept=".py,text/x-python"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFileError(f ? checkFile(f.name, f.size) : null);
            setDismissed(state);
          }}
        />
        <Button
          type="submit"
          className={styles.submit}
          pending={pending}
          pendingLabel="Uploading"
          aria-disabled={blocked || undefined}
          aria-describedby={!online ? "upload-offline" : undefined}
        >
          Upload version
        </Button>
      </div>
      {!online && (
        <p id="upload-offline" role="status" className={`small ${styles.note}`}>
          You&apos;re offline. Upload comes back when you reconnect.
        </p>
      )}
      {message && (
        <p role={isError ? "alert" : "status"} className={`small ${styles.msg} ${isError ? "error-text" : ""}`}>
          {message}
          {fileError === null && server?.signIn && (
            <>
              {" "}
              <Link href="/sign-in?next=/me">Sign in</Link>
            </>
          )}
        </p>
      )}
      <p className={`small ${styles.phone}`}>Best on a computer: you&apos;ll need the file from your own machine.</p>
    </form>
  );
}
