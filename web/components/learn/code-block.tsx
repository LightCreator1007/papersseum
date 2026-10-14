"use client";

import { useRef, useState, type ReactNode } from "react";

// Wraps every fenced code block in a lesson and adds a copy button.
export function CodeBlock({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = ref.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions). The text is still selectable.
    }
  }

  return (
    <div className="codeblock">
      <button type="button" className="copy" onClick={copy} aria-label="Copy code">
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={ref}>{children}</pre>
    </div>
  );
}
