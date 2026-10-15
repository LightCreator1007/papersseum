import "../learn/learn.css";
import { Suspense } from "react";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { docGroups } from "@/lib/docs/manifest";
import { DocsNav } from "./docs-nav";
import styles from "./docs.module.css";

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  const groups = docGroups();
  return (
    <div className={styles.shell}>
      <SmoothScroll />
      <aside className={styles.side}>
        <Suspense fallback={<DocsNav groups={groups} static />}>
          <DocsNav groups={groups} />
        </Suspense>
      </aside>
      <div className={styles.main}>{children}</div>
    </div>
  );
}
