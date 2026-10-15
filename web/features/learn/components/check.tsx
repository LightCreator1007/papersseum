import type { ReactNode } from "react";

// One "check yourself" question. The answer stays hidden until the reader opens it:
//   <Check q="What is 2 + 2?">It is 4, because ...</Check>
export function Check({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="check">
      <summary>{q}</summary>
      <div className="check-answer">{children}</div>
    </details>
  );
}
