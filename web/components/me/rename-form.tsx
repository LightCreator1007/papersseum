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
