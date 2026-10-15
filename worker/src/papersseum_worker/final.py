"""Final standings: run batch Plackett-Luce over a final round's matches.

Run on the worker VM after the final round finishes:
    papersseum-final --round 412            # print
    papersseum-final --round 412 --write    # print and record

House bots in a final round are ranked too; the results page filters them out
when it renders.
"""
import argparse
import sys
from collections import defaultdict

from psycopg import errors
from psycopg.types.json import Jsonb

from papersseum.rating import final_ranking
from papersseum_worker import db


class NotReady(Exception):
    pass


def standings_for_round(conn, round_id, allow_ladder=False):
    row = conn.execute("select kind from public.rounds where id = %s", (round_id,)).fetchone()
    if row is None:
        raise NotReady(f"round {round_id} doesn't exist")
    if row[0] != "final" and not allow_ladder:
        raise NotReady(f"round {round_id} is a {row[0]} round; pass --allow-ladder to rank it anyway")
    pending = conn.execute(
        "select count(*) from public.matches where round_id = %s and status in ('queued', 'running')",
        (round_id,)).fetchone()[0]
    if pending:
        raise NotReady(f"{pending} matches are still queued or running; wait for them to finish")
    seats = conn.execute(
        """select m.id, mp.bot_id, b.name, mp.placement
             from public.matches m
             join public.match_players mp on mp.match_id = m.id
             join public.bots b on b.id = mp.bot_id
            where m.round_id = %s and m.status = 'done'
            order by m.id, mp.placement""", (round_id,)).fetchall()
    if not seats:
        raise NotReady(f"round {round_id} has no finished matches")

    orders, names, played = defaultdict(list), {}, defaultdict(int)
    for match_id, bot_id, name, _placement in seats:
        bot = str(bot_id)
        names[bot] = name
        if bot in orders[match_id]:
            continue
        orders[match_id].append(bot)
        played[bot] += 1
    ranked = final_ranking(list(orders.values()))
    return [{"rank": i + 1, "bot_id": b, "name": names[b], "strength": s, "matches": played[b]}
            for i, (b, s) in enumerate(ranked)]


def record(conn, round_id, standings):
    conn.execute("select internal.record_final_standings(%s, %s)", (round_id, Jsonb(standings)))


def main(argv=None):
    p = argparse.ArgumentParser(prog="papersseum-final", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--round", type=int, required=True)
    p.add_argument("--write", action="store_true", help="record the standings (needs the database function)")
    p.add_argument("--allow-ladder", action="store_true", help="rank a round that is not a final")
    args = p.parse_args(argv)
    conn = db.connect()
    try:
        standings = standings_for_round(conn, args.round, args.allow_ladder)
    except NotReady as e:
        print(f"not ready: {e}", file=sys.stderr)
        return 2
    print(f"{'rank':>4}  {'bot':<32} {'strength':>9} {'matches':>7}")
    for s in standings:
        print(f"{s['rank']:>4}  {s['name']:<32} {s['strength']:>9.3f} {s['matches']:>7}")
    if args.write:
        try:
            record(conn, args.round, standings)
        except errors.UndefinedFunction:
            print("not recorded: internal.record_final_standings isn't deployed yet (ask A11). "
                  "The table above is the result; run again with --write once it is.", file=sys.stderr)
            return 3
        print(f"recorded {len(standings)} standings for round {args.round}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
