import { PLAYER_COLORS } from "@/features/ladder/colors";

export function Swatch({ slot }: { slot: number }) {
  return <span className="swatch" style={{ background: PLAYER_COLORS[slot] }} aria-hidden="true" />;
}
