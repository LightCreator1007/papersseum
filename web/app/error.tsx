"use client";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <h1>Something went wrong.</h1>
      <p className="muted" style={{ margin: "8px 0 20px" }}>
        The page hit an unexpected problem.
      </p>
      <button type="button" className="btn" onClick={() => retry()}>
        Try again
      </button>
    </>
  );
}
