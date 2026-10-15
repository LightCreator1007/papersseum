"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";

// Dev-only annotation toolbar (agentation.dev). Click an element, write a note, and copy the
// "Page Feedback" block into the agent. Set NEXT_PUBLIC_AGENTATION_ENDPOINT (for example
// http://localhost:4747, from `npx agentation-mcp server`) to sync notes to an MCP collector
// instead; without it the toolbar works in copy-and-paste mode and makes no network calls.
const Agentation = dynamic(() => import("agentation").then((m) => m.Agentation), { ssr: false });

class ToolbarBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function AgentationToolbar() {
  const endpoint = process.env.NEXT_PUBLIC_AGENTATION_ENDPOINT || undefined;
  return (
    <ToolbarBoundary>
      <Agentation endpoint={endpoint} />
    </ToolbarBoundary>
  );
}
