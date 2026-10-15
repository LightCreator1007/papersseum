import { ViewTransition } from "react";

// A template re-mounts on every navigation, so enter and exit fire here, where a
// layout (which persists) would never trigger them. Styles live in styles/motion.css.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="cell-wipe" exit="cell-out" default="none">
      {children}
    </ViewTransition>
  );
}
