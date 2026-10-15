export type NotificationKind = "submission_passed" | "submission_rejected" | "first_match" | "final_results";
export type Notification = {
  id: number;
  kind: NotificationKind;
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);

export function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function describeNotification(n: Notification): { title: string; body: string; href: string } {
  const p = n.payload ?? {};
  switch (n.kind) {
    case "submission_passed": {
      const v = num(p.version);
      return { title: v ? `Version ${v} passed` : "Your upload passed", body: "It plays from the next round.", href: "/me" };
    }
    case "submission_rejected": {
      const v = num(p.version);
      return {
        title: v ? `Version ${v} was rejected` : "Your upload was rejected",
        body: str(p.error) ?? "Open your bot page to see why.",
        href: "/me",
      };
    }
    case "first_match": {
      const id = num(p.match_id);
      const place = num(p.placement);
      return {
        title: "Your first match is in",
        body: place ? `You finished ${ordinal(place)} of 5.` : "Open it to see how it went.",
        href: id ? `/matches/${id}` : "/matches",
      };
    }
    case "final_results": {
      const rank = num(p.rank);
      return {
        title: rank ? `Final standings are out: you placed ${ordinal(rank)}` : "Final standings are out",
        body: "See the full table.",
        href: "/leaderboard",
      };
    }
    default:
      return { title: "Update", body: "Something changed on your bot.", href: "/me" };
  }
}
