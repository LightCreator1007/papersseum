import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Getting started" };

export default function GettingStartedPage() {
  return (
    <article className="prose">
      <h1>Getting started</h1>
      <p className="muted">
        Five bots drop into a circular arena for 180 seconds. Leave your land and you draw a trail; close the loop and
        everything inside becomes yours. Cut a rival&apos;s trail and you take their land. Whoever owns the most of the
        map at the end wins.
      </p>

      <h2>1. Install the package</h2>
      <pre>pip install papersseum</pre>
      <p>
        Or from a clone of the repository: <code>pip install -e .</code>
      </p>
      <p>
        Rendering match videos (<code>--render</code>) needs <code>pip install &quot;papersseum[viewer]&quot;</code> and
        ffmpeg on your PATH.
      </p>

      <h2>2. Write an agent</h2>
      <pre>papersseum new my_agent.py</pre>
      <p>
        Your file defines a class named <code>Agent</code> with two methods:
      </p>
      <pre>{`class Agent:
    def reset(self, config: dict) -> None:
        """Called once per match with the constants and a seed."""

    def act(self, obs: dict) -> int:
        """Called every decision. Return 0 (straight), 1 (left) or 2 (right)."""`}</pre>
      <p>
        <code>obs</code> holds a global view <code>(16, 120, 120)</code>, a local view <code>(16, 31, 31)</code>{" "}
        rotated so your heading points up, and scalars such as your coverage, speed and time left. Use{" "}
        <code>papersseum.channels</code> for named channel indices.
      </p>

      <h2>3. Test it locally</h2>
      <pre>{`papersseum validate my_agent.py                 # the same scan and a short local test match; the server's check is stricter
papersseum play my_agent.py --vs greedy,hunter --render match.mp4
papersseum eval my_agent.py --games 30           # placements, coverage and rating`}</pre>
      <p>
        Add <code>--save-replay game.jsonl.gz</code> to <code>play</code> and watch the match in your browser on the{" "}
        <Link href="/replay">replay page</Link>. The file isn&apos;t uploaded.
      </p>

      <h2>4. Limits</h2>
      <ul>
        <li>One <code>.py</code> file, up to 1 MB.</li>
        <li>
          <code>reset()</code> gets 2 seconds. Each <code>act()</code> gets 50 ms; a late or invalid answer plays
          straight.
        </li>
        <li>
          A bot that is too slow is stopped and plays straight for the rest of that match. That happens if, once it has
          played 50 moves, more than 20% of its moves are late, or if its late moves add up to more than 20 seconds over
          the budget in total.
        </li>
        <li>
          Allowed imports: numpy, math, random, itertools, collections, functools, heapq, bisect, typing,
          dataclasses, enum, json, copy, operator, statistics, array, re, string, time, abc, fractions, decimal,
          numbers, contextlib, papersseum and torch.
        </li>
        <li>
          Blocked calls include, for example, <code>open</code>, <code>eval</code>, <code>exec</code>,{" "}
          <code>getattr</code> and <code>vars</code>, and raw <code>numpy.load</code> / <code>torch.load</code>. The list
          is not exhaustive. Weights files can&apos;t be uploaded through the website yet, so keep everything your agent
          needs inside the one <code>.py</code> file.
        </li>
      </ul>

      <h2>5. Upload</h2>
      <p>
        <Link href="/me">Sign in and upload</Link> your file. It plays a test match first; if it passes it joins the
        ladder and plays a match every 15 minutes. One upload every 10 minutes.
      </p>

      <h2>How ranking works</h2>
      <p>
        Every match updates each bot&apos;s Elo from how it placed and how much land it held. The leaderboard ranks by rating, which is Elo
        minus twice its uncertainty: the uncertainty shrinks as a bot plays more games, so a new bot can&apos;t top
        the table after a few lucky wins.
      </p>
    </article>
  );
}
