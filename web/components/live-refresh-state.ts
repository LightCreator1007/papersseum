// The connection state behind <LiveRefresh>. Pure, so it is unit-tested.
//
// connecting: the channel is joining. Usually under a second.
// live: SUBSCRIBED; row changes re-render the page.
// reconnecting: the join failed, timed out or the channel closed, or it never
//   joined within CONNECT_GRACE_MS. The page polls and says so until it is back.

export type LiveState = "connecting" | "live" | "reconnecting";
export type ChannelStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";
export type LiveEvent = ChannelStatus | "grace-expired";

export const POLL_MS = 30_000;
export const CONNECT_GRACE_MS = 10_000;

export function nextLiveState(prev: LiveState, event: LiveEvent): LiveState {
  switch (event) {
    case "SUBSCRIBED":
      return "live";
    case "TIMED_OUT":
    case "CHANNEL_ERROR":
    case "CLOSED":
      return "reconnecting";
    case "grace-expired":
      return prev === "connecting" ? "reconnecting" : prev;
  }
}

// Poll whenever changes can't arrive by themselves.
export const shouldPoll = (state: LiveState): boolean => state !== "live";

// Back from a drop: changes made meanwhile were missed, so fetch once.
export const shouldCatchUp = (prev: LiveState, next: LiveState): boolean => prev === "reconnecting" && next === "live";

export function reconnectingText(online: boolean): string {
  return online ? "Reconnecting. Checking for updates every 30 s." : "Offline. Updates resume when you're back online.";
}
