import Link from "next/link";
import { Suspense } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { BoardReplay } from "@/features/replay/components/board-replay";
import { BotCharacter } from "@/components/character/bot-character";
import { CountUp } from "@/components/home/count-up";
import { Faq } from "@/components/home/faq";
import { GetStarted } from "@/components/home/get-started";
import styles from "@/components/home/home.module.css";
import { HeroFit } from "@/components/home/hero-fit";
import { HomeMotion } from "@/components/home/home-motion";
import { RosterMarquee } from "@/components/home/roster-marquee";
import { RuleInstruments } from "@/components/home/rule-instruments";
import { StrategyTabs } from "@/components/home/strategy-tabs";
import { TickingChip } from "@/components/home/ticking-chip";
import { LoadBoundary } from "@/components/load-boundary";
import { Reveal } from "@/components/motion/reveal";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { NextRound } from "@/features/ladder/components/next-round";
import { SignInButton } from "@/features/auth/components/sign-in-button";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { genomeFromSeed } from "@/lib/character/genome";
import { nextRoundSentence } from "@/features/ladder/format";
import { getLadderStats, getSeason } from "@/features/ladder/queries";
import { getRoundOutlook } from "@/features/ladder/round-outlook";
import { getUserId } from "@/lib/supabase/server";


async function HeroActions() {
  const signedIn = (await getUserId()) !== null;
  return (
    <div className={styles.heroActions}>
      {signedIn ? <ButtonLink href="/me#upload">Upload a bot</ButtonLink> : <SignInButton next="/me" />}
      <Link href="/docs/getting-started">Read the rules</Link>
    </div>
  );
}

async function ProofStats() {
  const [season, stats, userId] = await Promise.all([getSeason(), getLadderStats(), getUserId()]);
  const outlook = await getRoundOutlook(season.frozen);
  if (stats.matches === 0) {
    return (
      <EmptyState
        className={styles.statsEmpty}
        title="No matches yet"
        body={nextRoundSentence(outlook, { first: true })}
        action={userId ? { label: "Upload your bot", href: "/me#upload" } : { label: "Get started", href: "/docs/getting-started" }}
      />
    );
  }
  return (
    <dl className={styles.stats}>
      <div>
        <dt>Bots on the ladder</dt>
        <dd>
          <CountUp value={stats.bots} />
        </dd>
      </div>
      <div>
        <dt>Matches played</dt>
        <dd>
          <CountUp value={stats.matches} delay={0.12} />
        </dd>
      </div>
      <div>
        <dt>Next round</dt>
        <dd data-text={(!season.frozen && outlook.backlog) || undefined}>
          {season.frozen ? "Frozen" : <NextRound frozen={false} backlog={outlook.backlog} compact />}
        </dd>
      </div>
    </dl>
  );
}

function Section({ label, title, body, children }: { label: string; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <p className={styles.label}>{label}</p>
      <Reveal as="h2" lines className={styles.h2}>
        {title}
      </Reveal>
      {body && <p className={styles.sub}>{body}</p>}
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <HomeMotion />

      {/* Hero: an editorial masthead. The name, one line of pitch, the board. */}
      <section className={styles.hero} data-hero>
        <HeroFit />
        <h1 className={styles.word} aria-label="Papersseum">
          {[..."Papersseum"].map((ch, i) => (
            <span key={i} aria-hidden style={{ animationDelay: `${120 + i * 45}ms` }}>
              {ch}
            </span>
          ))}
        </h1>
        <div className={styles.heroBody}>
          <div className={styles.heroIntro}>
            <p className={styles.heroLede}>
              Write a Python bot. Every 15 minutes it plays four others for territory, and Elo keeps the score.
            </p>
            <Suspense fallback={<div style={{ height: 40 }} />}>
              <HeroActions />
            </Suspense>
          </div>
          <figure className={`board ${styles.plate}`}>
            <BoardReplay />
          </figure>
        </div>
      </section>

      {/* Four product cards, each with a small working mock. */}
      <Section
        label="How it works"
        title="Your bot plays while you sleep."
        body="Write it once. It's checked, matched and rated around the clock, and every game is there to watch back."
      >
        <div className={styles.cards}>
          <article className={styles.card}>
            <div className={styles.mock}>
              <div className={styles.editor}>
                <span className={styles.fileTab}>my_agent.py</span>
                <pre>
                  <code>
                    <span className={styles.kw}>class</span> Agent:{"\n"}
                    {"    "}
                    <span className={styles.kw}>def</span> act(self, obs):{"\n"}
                    {"        "}local = obs[<span className={styles.str}>&quot;local&quot;</span>]{"\n"}
                    {"        "}
                    <span className={styles.kw}>return</span> <span className={styles.num}>0</span>
                    <span className={styles.cm}>  # straight</span>
                  </code>
                </pre>
              </div>
            </div>
            <h3>Write it in Python</h3>
            <p>One file, one Agent class. It sees a 31×31 view around its head and answers straight, left or right.</p>
          </article>

          <article className={styles.card}>
            <div className={styles.mock}>
              <div className={styles.checkMock}>
                <TickingChip label="Validating" />
                <ul>
                  <li data-done>File under 1 MB</li>
                  <li data-done>Static scan passed</li>
                  <li data-run>Test match vs house bots</li>
                </ul>
              </div>
            </div>
            <h3>Checked before it plays</h3>
            <p>A scan and a sealed test match. A broken upload never replaces the version that already works.</p>
          </article>

          <article className={styles.card}>
            <div className={styles.mock}>
              <div className={styles.replayMock}>
                <picture>
                  <source srcSet="/board-dark.svg" media="(prefers-color-scheme: dark)" />
                  <img src="/board-light.svg" alt="" width={120} height={120} />
                </picture>
                <div className={styles.scrub}>
                  <span>▶</span>
                  <i>
                    <b />
                  </i>
                  <em>1:23 / 3:00</em>
                </div>
              </div>
            </div>
            <h3>Watch every match back</h3>
            <p>Each game replays in your browser from its seed, so you can see exactly where your bot went wrong.</p>
          </article>

          <article className={styles.card}>
            <div className={styles.mock}>
              <div className={styles.toastMock}>
                <div className={styles.toast}>
                  <BotCharacter genome={genomeFromSeed("you")} size={32} accent="var(--slot-2)" state="win" label="" />
                  <div>
                    <b>Your bot moved up to #2</b>
                    <span>+14.7 Elo · 1st place in match 66</span>
                  </div>
                </div>
                <ol className={styles.miniLadder}>
                  <li>1 · house_hunter</li>
                  <li data-you>2 · your_bot ▲</li>
                  <li>3 · greedy_v2</li>
                </ol>
              </div>
            </div>
            <h3>Climb the ladder</h3>
            <p>Every finish moves your Elo. Rank uses Elo minus twice its uncertainty, so luck can&apos;t top the table.</p>
          </article>
        </div>
      </Section>

      <Section
        label="Strategies"
        title="Give your bot a plan."
        body="Four baselines ship with the package. Beat them locally, then bring your own idea to the ladder."
      >
        <StrategyTabs />
      </Section>

      {/* Social proof: who's playing right now. */}
      <section className={styles.proof}>
        <p className={styles.label}>On the ladder now</p>
        <LoadBoundary what="the roster" quiet>
          <Suspense fallback={null}>
            <RosterMarquee />
          </Suspense>
        </LoadBoundary>
        <LoadBoundary what="ladder stats">
          <Suspense fallback={<div className={styles.stats} />}>
            <ProofStats />
          </Suspense>
        </LoadBoundary>
      </section>

      <Section label="The rules" title="Small limits. Big strategy space.">
        <RuleInstruments />
        <p className={styles.more}>
          <Link href="/docs/competition">Read the full competition guide →</Link>
        </p>
      </Section>

      <Section
        label="Get started"
        title="From pip install to the ladder."
        body="Three commands on your machine, then one upload. From there it plays every round, around the clock."
      >
        <GetStarted />
      </Section>

      <Section label="Questions" title="Before you upload.">
        <Faq />
      </Section>

      <section className={styles.cta}>
        <BotCharacter genome={genomeFromSeed("papersseum")} size={96} accent="var(--slot-3)" state="idle" label="" lookAt />
        <h2>Build your first bot.</h2>
        <p className={styles.ctaSub}>
          Start from the example bot, upload it, and it joins the next round. New to reinforcement learning? The free
          course starts from zero.
        </p>
        <div className={styles.actions}>
          <ButtonLink href="/docs/getting-started" className={styles.ctaPrimary}>
            Start in 5 minutes
          </ButtonLink>
          <ButtonLink href="/learn" variant="ghost" className={styles.ctaGhost}>
            Learn RL from zero
          </ButtonLink>
        </div>
      </section>

      <AutoRefresh />
    </>
  );
}
