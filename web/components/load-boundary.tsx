"use client";

import { catchError, type ErrorInfo } from "next/error";

function Fallback({ what, quiet }: { what: string; quiet?: boolean }, { retry }: ErrorInfo) {
  if (quiet) return null;
  return (
    <p className="muted">
      Couldn&apos;t load {what}.{" "}
      <button type="button" className="link-button" onClick={() => retry()}>
        Try again
      </button>
    </p>
  );
}

export const LoadBoundary = catchError(Fallback);
