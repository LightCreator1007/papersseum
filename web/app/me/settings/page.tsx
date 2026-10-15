import { ContactOrganisers } from "@/components/contact-organisers";
import type { Metadata } from "next";
import { Suspense } from "react";
import { setEmailOptIn } from "@/features/upload/actions";
import { ActionForm } from "@/components/me/action-form";
import styles from "@/components/me/me.module.css";
import { BotNameControl } from "@/components/me/rename-form";
import { Placeholder } from "@/components/placeholder";
import { requireMyBot } from "@/lib/me";

export const metadata: Metadata = { title: "Settings" };

async function SettingsContent() {
  const { bot } = await requireMyBot("/me/settings");
  if (!bot) return <ContactOrganisers lead="Your account has no bot." />;
  return (
    <>
      <section className={styles.panel}>
        <h2>Bot name</h2>
        {!bot.renamedFrom && (
          <p className="muted small">
            One rename per season. Old links to {bot.name} keep working, and nobody else can take the old name.
          </p>
        )}
        <BotNameControl bot={bot} />
      </section>

      <section className={styles.panel}>
        <h2>Email</h2>
        <p className="muted small">
          Off by default. When on, you get an email when an upload passes or fails and after your first match. The inbox
          always updates either way.
        </p>
        <ActionForm action={setEmailOptIn} submit="Save">
          <label className={styles.row}>
            <input type="checkbox" name="opt_in" /> Email me about my bot
          </label>
        </ActionForm>
      </section>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Placeholder lines={6} />}>
      <SettingsContent />
    </Suspense>
  );
}
