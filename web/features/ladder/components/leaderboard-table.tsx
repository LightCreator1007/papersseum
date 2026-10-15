import Link from "next/link";
import { elo } from "@/features/ladder/format";
import { botHref } from "@/features/ladder/links";
import { getLeaderboard } from "@/features/ladder/queries";

export async function LeaderboardTable({ limit, compact = false }: { limit?: number; compact?: boolean }) {
  const rows = await getLeaderboard(limit);
  if (rows.length === 0) return <p className="muted">No bots on the ladder yet.</p>;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Bot</th>
            {!compact && <th>Owner</th>}
            <th className="num">Rating</th>
            {!compact && <th className="num">Elo</th>}
            {!compact && <th className="num">±</th>}
            <th className="num">Games</th>
            {!compact && <th className="num">Version</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.botId}>
              <td>{r.rank}</td>
              <td>
                <Link href={botHref(r.name)}>{r.name}</Link>
              </td>
              {!compact && <td className="muted">{r.isHouse ? "house bot" : r.owner}</td>}
              <td className="num">
                <b>{elo(r.rating)}</b>
              </td>
              {!compact && <td className="num">{elo(r.elo)}</td>}
              {!compact && <td className="num muted">{elo(r.sigma)}</td>}
              <td className="num">{r.games}</td>
              {!compact && <td className="num muted">{r.version ? `v${r.version}` : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
