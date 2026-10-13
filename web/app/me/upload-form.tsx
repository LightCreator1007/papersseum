"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { uploadBot, type UploadState } from "@/app/me/actions";
import { checkFile } from "@/lib/upload-rules";

const INITIAL: UploadState = { ok: false, message: null };

export function UploadForm({ activeVersion, cooldownMinutes }: { activeVersion: number | null; cooldownMinutes: number }) {
  const [state, action, pending] = useActionState(uploadBot, INITIAL);
  const [fileError, setFileError] = useState<string | null>(null);
  // Server render and hydration see false, the client sees true afterwards, so the
  // button stays disabled until the form action is wired up.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  const message = fileError ?? state.message;
  const isError = fileError !== null || !state.ok;

  return (
    <form ref={formRef} action={action} className="box">
      <p style={{ fontWeight: 600 }}>Upload a new version</p>
      <p className="muted small" style={{ margin: "4px 0 14px" }}>
        One <span className="mono">.py</span> file, up to 1 MB. It&apos;s checked first; if it passes it
        {activeVersion ? ` replaces version ${activeVersion}` : " joins the ladder"}.
        {cooldownMinutes > 0 && ` One upload every ${cooldownMinutes} minutes.`} Test it locally first with{" "}
        <span className="mono">papersseum validate agent.py</span>.
      </p>
      <div className="actions">
        <input
          type="file"
          name="file"
          aria-label="Bot file (.py)"
          accept=".py,text/x-python"
          required
          onChange={(e) => {
            const f = e.target.files?.[0];
            setFileError(f ? checkFile(f.name, f.size) : null);
          }}
        />
        <button type="submit" className="btn" disabled={!hydrated || pending || fileError !== null} style={{ marginLeft: "auto" }}>
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
      {message && (
        <p role="status" className={`small ${isError ? "error-text" : ""}`} style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
    </form>
  );
}
