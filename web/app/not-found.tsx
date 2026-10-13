import Link from "next/link";

export default function NotFound() {
  return (
    <div className="stack">
      <h1>Not found</h1>
      <p className="muted">There&apos;s nothing at this address.</p>
      <p>
        <Link href="/">Back to the home page</Link>
      </p>
    </div>
  );
}
