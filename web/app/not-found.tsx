import Link from "next/link";
import { DinoGame } from "@/components/dino/dino-game";
import { ButtonLink } from "@/components/ui/button";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <section className={styles.page}>
      <p className={styles.code}>404</p>
      <h1>Off the board.</h1>
      <p className={styles.sub}>
        There&apos;s nothing at this address. While you&apos;re here, how far can a bot run?
      </p>
      <DinoGame />
      <div className={styles.actions}>
        <ButtonLink href="/">Back to the arena</ButtonLink>
        <Link href="/leaderboard">See the leaderboard</Link>
      </div>
    </section>
  );
}
