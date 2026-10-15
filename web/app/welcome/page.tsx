import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BotCharacter } from "@/components/character/bot-character";
import { RenameForm } from "@/components/me/rename-form";
import { Placeholder } from "@/components/placeholder";
import { ButtonLink } from "@/components/ui/button";
import { characterFor, signatureColor } from "@/lib/character/for-bot";
import { requireMyBot } from "@/lib/me";
import { getProfileHandle } from "@/features/ladder/queries";
import { safeNext } from "@/features/auth/redirect";
import styles from "./welcome.module.css";
import { ISSUES_URL } from "@/components/contact-organisers";

export const metadata: Metadata = { title: "Welcome", robots: { index: false } };


// First sign-in only (the auth callback sends new accounts here). FigJam Flow 1 and the
// Identity stickies: show the public name before anything else is public, offer the one
// rename, say what is and isn't public, then point at the quickstart.

const NEXT_STEPS = [
  { n: "01", title: "Set up locally", body: "Install the package and write a starter bot.", code: "pip install papersseum", href: "/docs/getting-started" },
  { n: "02", title: "Pick a look", body: "Build the character that plays for you on the board.", code: null, href: "/me/forge" },
  { n: "03", title: "Upload it", body: "It's checked, then plays a match every 15 minutes.", code: null, href: "/me" },
] as const;

async function WelcomeContent({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const { userId, bot } = await requireMyBot("/welcome");
  if (!bot) {
    return (
      <p className="muted">
        Your account has no bot. To get one set up,{" "}
        <a href={ISSUES_URL} target="_blank" rel="noreferrer">open an issue on GitHub</a>.
      </p>
    );
  }
  const handle = await getProfileHandle(userId).catch(() => null);
  const genome = characterFor({ name: bot.name });
  const accent = signatureColor(genome);

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.intro}>
          <p className={styles.kicker}>{handle ? `Welcome, ${handle}` : "Welcome"}</p>
          <h1>Meet your bot.</h1>
          <p className={styles.lede}>
            Everyone sees it as <b>{bot.name}</b>. You can rename it once this season, here or later in Settings.
          </p>
          <RenameForm name={bot.name} />
          <dl className={styles.visibility}>
            <div>
              <dt>Public</dt>
              <dd>
                Bot name, character, rank and every match it plays{handle ? `, and ${handle} as its owner` : ""}.
              </dd>
            </div>
            <div>
              <dt>Private</dt>
              <dd>Your email and your code.</dd>
            </div>
          </dl>
        </div>

        <figure className={styles.stage}>
          <div className={styles.plinth} style={{ "--c": accent } as React.CSSProperties}>
            <BotCharacter genome={genome} size={160} accent={accent} state="idle" label={bot.name} lookAt />
          </div>
          <div className={styles.preview} aria-label="How your bot appears on the leaderboard">
            <span className={styles.rank}>-</span>
            <BotCharacter genome={genome} size={24} accent={accent} state="still" label="" />
            <b>{bot.name}</b>
            <span className={styles.owner}>{handle && handle !== bot.name ? handle : ""}</span>
            <span className={styles.unrated}>Not rated yet</span>
          </div>
          <figcaption>On the leaderboard, before your first match.</figcaption>
        </figure>
      </section>

      <section className={styles.next} aria-labelledby="next-title">
        <h2 id="next-title">Three steps to your first match</h2>
        <ol>
          {NEXT_STEPS.map((s) => (
            <li key={s.n}>
              <Link href={s.href}>
                <span className={styles.n}>{s.n}</span>
                <b>{s.title}</b>
                <span>{s.body}</span>
                {s.code && <code>{s.code}</code>}
              </Link>
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          <ButtonLink href="/docs/getting-started">Start the quickstart</ButtonLink>
          <Link href={next}>Skip to your bot</Link>
        </div>
      </section>
    </>
  );
}

export default function WelcomePage(props: PageProps<"/welcome">) {
  return (
    <Suspense fallback={<Placeholder lines={8} />}>
      <WelcomeContent searchParams={props.searchParams} />
    </Suspense>
  );
}
