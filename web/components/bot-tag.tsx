import Link from "next/link";
import { BotCharacter } from "@/components/character/bot-character";
import { characterFor, signatureColor } from "@/lib/character/for-bot";
import { botHref } from "@/features/ladder/links";

// A bot name with its 24px character in front, linking to the profile.
// `appearance` is the bot's saved character; without one the name seeds it.
export function BotTag({
  name,
  appearance,
  accent,
  size = 24,
}: {
  name: string;
  appearance?: unknown;
  accent?: string;
  size?: number;
}) {
  const g = characterFor({ name, appearance });
  return (
    <Link href={botHref(name)} className="bot-tag">
      <BotCharacter genome={g} size={size} accent={accent ?? signatureColor(g)} state="still" label="" />
      <span>{name}</span>
    </Link>
  );
}
