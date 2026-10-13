import Link from "next/link";
import { Swatch } from "@/components/swatch";
import { MATCH_STATUS, clockTime, nextRoundAt, relativeTime } from "@/lib/format";
import { botHref, matchHref } from "@/lib/links";
import { getMatches, type SeatSummary } from "@/lib/queries";

function Seats({ seats }: { seats: SeatSummary[] }) {
  return seats.map((s) => (
    <span key={s.slot} className="seat">
      <Swatch slot={s.slot} />
      {s.name ? <Link href={botHref(s.name)}>{s.name}</Link> : <span className="muted">deleted bot</span>}
      {s.crashed && <span className="muted"> (crashed)</span>}
    </span>
  ));
}

export async function MatchList({ page = 1, pageSize = 50, compact = false }: { page?: number; pageSize?: number; compact?: boolean }) {
  const { matches, hasMore } = await getMatches({ page, pageSize });
  if (matches.length === 0) {
    return page === 1 ? (
      <p className="muted">
        No matches yet. The first round starts at{" "}
        {/* eslint-disable-next-line react-hooks/purity -- server component, rendered fresh for each request */}
        {clockTime(nextRoundAt(Date.now()))}.
      </p>
    ) : (
      <p className="muted">
        No more matches. <Link href="/matches">Back to the newest</Link>
      </p>
    );
  }
  return (
    <>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 72 }}>Match</th>
              <th style={{ width: 110 }}>When</th>
              {!compact && <th style={{ width: 90 }}>Status</th>}
              <th>Finishing order</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href={matchHref(m.id)}>{m.id}</Link>
                </td>
                <td className="muted">{relativeTime(m.finishedAt ?? m.createdAt)}</td>
                {!compact && <td className={m.status === "failed" ? "down" : undefined}>{MATCH_STATUS[m.status]}</td>}
                <td>
                  <Seats seats={m.seats} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && (page > 1 || hasMore) && (
        <div className="pagination">
          <span>{page > 1 && <Link href={page === 2 ? "/matches" : `/matches?page=${page - 1}`}>Newer</Link>}</span>
          <span>{hasMore && <Link href={`/matches?page=${page + 1}`}>Older</Link>}</span>
        </div>
      )}
    </>
  );
}
