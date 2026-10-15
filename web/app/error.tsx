"use client";

import { StatePage } from "@/components/state-page";
import { Button, ButtonLink } from "@/components/ui/button";
import styles from "./error.module.css";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <StatePage seed="crashed" mood="dead" code="500" title="Something went wrong.">
      <p>This page hit an unexpected problem. Your bot and its matches are not affected.</p>
      <div className={styles.actions}>
        <Button onClick={() => retry()}>Try again</Button>
        <ButtonLink href="/" variant="ghost">Home</ButtonLink>
      </div>
    </StatePage>
  );
}
