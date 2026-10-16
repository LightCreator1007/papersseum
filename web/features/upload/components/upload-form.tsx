"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { uploadBot, type UploadState } from "@/features/upload/actions";
import {
  MULTIPLE_FILES_NOTE,
  NETWORK_ERROR,
  NOT_TEXT_MESSAGE,
  STARTER_URL,
  VALIDATE_DOCS,
  checkFile,
  checkSource,
  formatBytes,
  isUtf8,
  splitName,
} from "@/features/upload/upload-rules";
import { cooldownLeft, countdown } from "@/features/upload/upload-view";
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

// Fetched once, the first time a file is read, to spot an unchanged starter.
let starter: Promise<string | null> | null = null;
const loadStarter = () =>
  (starter ??= fetch(STARTER_URL)
    .then((r) => (r.ok ? r.text() : null))
    .catch(() => null));

const noop = () => () => {};
// A one-second clock, only while a cooldown is running. Null on the server and during
// hydration, so the first render uses the wait the server measured.
const tick = (cb: () => void) => {
  const id = window.setInterval(cb, 1000);
  return () => window.clearInterval(id);
};
const nowSecond = () => Math.floor(Date.now() / 1000) * 1000;
const noClock = () => null;

const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;

type Picked = {
  file: File;
  error: string | null;
  warning: string | null;
  note: string | null;
  multiple: boolean;
  reading: boolean;
};

export function UploadForm({
  next,
  cooldownMinutes,
  nextUploadAt,
  initialWaitMs,
}: {
  next: number;
  cooldownMinutes: number;
  nextUploadAt: string | null;
  initialWaitMs: number;
}) {
  const [state, run, pending] = useActionState(send, INITIAL);
  const [picked, setPicked] = useState<Picked | null>(null);
  // The server's answer to the last upload, until a new file is picked.
  const [dismissed, setDismissed] = useState<UploadState | null>(null);
  const [over, setOver] = useState(false);
  // False in the server HTML and during hydration, true after, so nothing is clickable
  // until the handlers are attached.
  const hydrated = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const now = useSyncExternalStore(nextUploadAt ? tick : noop, nowSecond, noClock);
  const online = useOnline();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const readId = useRef(0);
  const router = useRouter();

  const waitMs = now === null ? initialWaitMs : cooldownLeft(nextUploadAt, now);
  const waiting = waitMs > 0;
  const accepting = hydrated && online && !waiting && !pending;
  const server = state === dismissed ? null : state;
  // A finished upload clears the chosen file; picking another brings the zone back.
  const shown = server?.ok ? null : picked;
  const ready = shown !== null && shown.error === null && !shown.reading;

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  // Leaving mid-upload would drop the request, so ask first.
  useEffect(() => {
    if (!pending) return;
    const hold = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [pending]);

  // Arriving from an "Upload" link (/me#upload) lands on the zone with focus in it.
  useEffect(() => {
    if (window.location.hash !== "#upload") return;
    document.getElementById("upload")?.scrollIntoView({ block: "start" });
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Cancelling the picker reports no file; keep whatever was chosen before.
  const pick = async (file: File | null, count = 1) => {
    if (!file) return;
    setDismissed(state);
    const id = ++readId.current;
    const base = { file, warning: null, note: null, multiple: count > 1 };
    const bad = checkFile(file.name, file.size);
    if (bad) {
      setPicked({ ...base, error: bad, reading: false });
      return;
    }
    setPicked({ ...base, error: null, reading: true });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (id !== readId.current) return; // a newer pick won
    if (!isUtf8(bytes)) {
      setPicked({ ...base, error: NOT_TEXT_MESSAGE, reading: false });
      return;
    }
    const source = checkSource(new TextDecoder().decode(bytes), await loadStarter());
    if (id !== readId.current) return;
    setPicked({ ...base, error: null, reading: false, ...source });
  };

  const onDrop = useEffectEvent((files: FileList) => {
    if (accepting && files.length > 0) void pick(files[0], files.length);
  });

  // The whole page takes a dropped file. While uploads are paused a drop is still caught,
  // so the browser doesn't navigate away to show the file.
  useEffect(() => {
    if (!hydrated) return;
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setOver(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const dragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      if (e.dataTransfer) onDrop(e.dataTransfer.files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", dragOver);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", dragOver);
      window.removeEventListener("drop", drop);
    };
  }, [hydrated]);

  // Submitting by hand rather than through the form action keeps the chosen file after a
  // refusal (React resets the form when an action runs), so a retry is one click. The file
  // goes in by hand too, since a dropped one never passes through the input.
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!accepting || !ready || !shown) return;
    const data = new FormData();
    data.set("file", shown.file, shown.file.name);
    startTransition(() => run(data));
  };

  const message = server?.message ?? null;
  const isError = server?.ok === false;
  const zoneState = !online ? "offline" : waiting ? "waiting" : shown ? "file" : "empty";

  return (
    <form ref={formRef} action={run} onSubmit={onSubmit} className={styles.form}>
      <label
        className={styles.zone}
        data-state={zoneState}
        data-over={(over && accepting) || undefined}
        data-pending={pending || undefined}
      >
        <input
          ref={inputRef}
          type="file"
          name="file"
          className={styles.input}
          aria-label="Bot file (.py)"
          aria-describedby="upload-meta"
          accept=".py,text/x-python"
          disabled={hydrated && !accepting}
          onChange={(e) => void pick(e.target.files?.[0] ?? null, e.target.files?.length ?? 0)}
        />
        <span className={styles.tick} data-c="tl" aria-hidden />
        <span className={styles.tick} data-c="tr" aria-hidden />
        <span className={styles.tick} data-c="bl" aria-hidden />
        <span className={styles.tick} data-c="br" aria-hidden />

        {zoneState === "offline" ? (
          <span className={styles.prompt} role="status">
            <b>You&apos;re offline</b>
            <span className="muted small">Upload comes back when you reconnect.</span>
          </span>
        ) : zoneState === "waiting" ? (
          <span className={styles.prompt}>
            <b>
              Next upload in <span className={`mono ${styles.clock}`}>{countdown(waitMs)}</span>
            </b>
            <span className="muted small">
              One upload every {cooldownMinutes} minutes. Keep editing; the zone opens when the timer ends.
            </span>
          </span>
        ) : shown ? (
          <FileChip picked={shown} pending={pending} />
        ) : (
          <span className={styles.prompt}>
            <b>
              <span className={styles.wide}>{over ? "Drop to use this file" : "Drop your .py file here"}</span>
              <span className={styles.narrow}>Choose your .py file</span>
            </b>
            <span className="muted small">
              <span className={styles.wide}>
                or <span className={styles.fake}>choose a file</span>
              </span>
              <span className={styles.narrow}>
                <span className={styles.fake}>Browse files</span>
              </span>
            </span>
          </span>
        )}
      </label>

      <div className={styles.foot}>
        <p id="upload-meta" className={`muted small ${styles.meta}`}>
          <span className="mono">.py</span>, up to 1 MB
          {cooldownMinutes > 0 && `, one upload every ${cooldownMinutes} min`}.{" "}
          <Link href={VALIDATE_DOCS}>Test it locally first</Link>
        </p>
        <Button
          type="submit"
          className={styles.submit}
          pending={pending}
          pendingLabel="Uploading"
          aria-disabled={!accepting || !ready || undefined}
        >
          {`Upload v${next}`}
        </Button>
      </div>

      {message && (
        <p role={isError ? "alert" : "status"} className={`small ${styles.msg} ${isError ? "error-text" : ""}`}>
          {message}
          {server?.signIn && (
            <>
              {" "}
              <Link href="/sign-in?next=/me">Sign in</Link>
            </>
          )}
        </p>
      )}
      <p className={`small ${styles.phone}`}>Best on a computer: the file has to be on this device.</p>
    </form>
  );
}

function FileChip({ picked, pending }: { picked: Picked; pending: boolean }) {
  const [head, tail] = splitName(picked.file.name);
  const status = pending ? "Uploading" : picked.error ?? (picked.reading ? "Reading" : picked.warning ?? "Ready to upload");
  const tone = pending || picked.reading ? "muted" : picked.error ? "error" : picked.warning ? "warn" : "ok";
  return (
    <span className={styles.chip}>
      <span className={styles.glyph} aria-hidden>
        py
      </span>
      <span className={styles.chipText}>
        <span className={styles.name} title={picked.file.name}>
          <span className={styles.head}>{head}</span>
          <span>{tail}</span>
          <span className={`muted ${styles.size}`}>{formatBytes(picked.file.size)}</span>
        </span>
        <span className={`small ${styles.status}`} data-tone={tone} role={picked.error ? "alert" : "status"}>
          {status}
        </span>
        {picked.note && <span className="muted small">{picked.note}</span>}
        {picked.multiple && <span className="muted small">{MULTIPLE_FILES_NOTE}</span>}
      </span>
      {!pending && <span className={`small ${styles.fake} ${styles.change}`}>Choose another</span>}
    </span>
  );
}
