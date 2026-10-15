import type { MyBot } from "@/features/ladder/queries";
import { renameBot } from "@/features/upload/actions";
import { ActionForm } from "@/components/me/action-form";
import styles from "@/components/me/me.module.css";

// The one-per-season rename, shared by Settings and Welcome.
export function RenameForm({ name }: { name: string }) {
  return (
    <ActionForm action={renameBot} submit="Rename">
      <label className="sr-only" htmlFor="bot-name">
        New name
      </label>
      <input
        id="bot-name"
        name="name"
        className={styles.input}
        defaultValue={name}
        maxLength={32}
        pattern="[a-z0-9_]{2,32}"
        title="2 to 32 characters: lowercase letters, digits and underscores"
        autoComplete="off"
        spellCheck={false}
        required
      />
    </ActionForm>
  );
}

// The rename form while this season's rename is unused; otherwise a line saying why it's gone.
export function BotNameControl({ bot }: { bot: Pick<MyBot, "name" | "banned" | "renamedFrom"> }) {
  if (bot.renamedFrom) {
    return (
      <p className="muted small">
        Renamed from {bot.renamedFrom} this season. Links to {bot.renamedFrom} still lead here, and the next rename comes
        with the next season.
      </p>
    );
  }
  if (bot.banned) return <p className="muted small">A banned bot can&apos;t be renamed.</p>;
  return <RenameForm name={bot.name} />;
}
