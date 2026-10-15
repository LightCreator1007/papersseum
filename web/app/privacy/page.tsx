import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

const REPO = "https://github.com/dhairya-pandya/papersseum";

// Keep this in step with what the app stores: supabase/migrations (tables,
// RLS, storage buckets, the sign-up trigger) and the third parties the site
// loads from. Update the date when anything here changes.
export default function PrivacyPage() {
  return (
    <article className="prose">
      <h1>Privacy</h1>
      <p className="muted">Last updated 16 October 2026.</p>
      <p>
        Papersseum is a season-long bot tournament for IIITDM Jabalpur. This page says what the site stores about
        you, who can see it, and how to have it removed. We don&apos;t run ads, sell data or use analytics or tracking.
      </p>

      <h2>Signing in</h2>
      <p>
        You sign in with Google, and only @iiitdmj.ac.in accounts are accepted. Google tells us your email address, your
        name and your profile picture&apos;s address. We use the email to check that you&apos;re from the institute and
        to keep you signed in; we don&apos;t email you. The site never shows your picture or email address.
      </p>
      <p>
        Your name, as it is on your Google account, is shown publicly as the owner of your bot, on the leaderboard and
        on your bot&apos;s page. If you change the name on your Google account, the site picks up the new one the next
        time you sign in.
      </p>
      <p>
        Your bot starts with a name made from the part of your email before the @ (for example <code>24bcs001</code>),
        so your roll number is public until you rename the bot. You can rename it once a season. The old name stays
        reserved for your bot, so old links still lead to it. Your account also keeps a handle made the same way; the
        site doesn&apos;t show it, but it can be read through the site&apos;s public data interface.
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> email address, the name and picture address Google sends, and when you signed
          up and last signed in.
        </li>
        <li>
          <strong>Your bot:</strong> its name, any earlier name, rating and number of games.
        </li>
        <li>
          <strong>Your uploads:</strong> each <code>.py</code> file you upload, with its size, a checksum, when you
          uploaded it, and the result of its checks.
        </li>
        <li>
          <strong>Matches:</strong> each match&apos;s seed, results, rating changes and a replay file (the moves every
          bot made).
        </li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li>
          <strong>Everyone</strong>, signed in or not: your name as your bot&apos;s owner, your handle, your
          bot&apos;s current and earlier names, ratings, match results and replays.
        </li>
        <li>
          <strong>Only you:</strong> your upload history, including why an upload was rejected.
        </li>
        <li>
          <strong>Nobody else downloads your code.</strong> It is read only by our match servers, which check it and run
          it in a sandbox to play matches. The organisers can read uploads when they need to investigate a bot that
          breaks the rules.
        </li>
      </ul>

      <h2>Replays you open yourself</h2>
      <p>
        On the <Link href="/replay">replay page</Link>, the file you pick is read and replayed inside your browser. It
        is never uploaded.
      </p>

      <h2>Cookies</h2>
      <p>
        The site sets only the cookies that keep you signed in. There are no advertising or analytics cookies, so there
        is nothing to opt out of.
      </p>

      <h2>Services we use</h2>
      <ul>
        <li>
          <strong>Google</strong> handles sign-in.
        </li>
        <li>
          <strong>Supabase</strong> hosts the database, sign-in sessions and the uploaded files.
        </li>
        <li>
          <strong>Vercel</strong> hosts the website.
        </li>
        <li>
          <strong>jsDelivr</strong> serves the Python runtime that watching a replay downloads.
        </li>
      </ul>
      <p>
        Like any website host, these services see your IP address and browser details when you use the site, and may
        keep them in short-lived logs for security and debugging. Their own privacy policies cover that.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account, bot and uploads for as long as the tournament runs, unless you ask us to delete them.
      </p>

      <h2>Deleting your data</h2>
      <p>
        Ask the organisers to delete your account. We remove your account, name, handle, bot and every file you uploaded. Past
        matches stay on the site so other players&apos; ratings still make sense, but your bot&apos;s name is removed
        from them.
      </p>

      <h2>Contact</h2>
      <p>
        For questions or deletion requests, contact the organisers through the project&apos;s{" "}
        <a href={REPO}>GitHub repository</a>.
      </p>
    </article>
  );
}
