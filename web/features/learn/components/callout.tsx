import type { ReactNode } from "react";

// A highlighted aside inside a lesson: <Callout title="Why this matters">...</Callout>
// kind: "idea" (default), "maths", "careful" or "try"
export function Callout({ title, kind = "idea", children }: { title?: string; kind?: "idea" | "maths" | "careful" | "try"; children: ReactNode }) {
  return (
    <aside className={`callout callout-${kind}`}>
      {title ? <p className="callout-title">{title}</p> : null}
      {children}
    </aside>
  );
}
