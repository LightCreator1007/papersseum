import { ContactOrganisers } from "@/components/contact-organisers";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Forge } from "@/components/me/forge";
import { Placeholder } from "@/components/placeholder";
import { requireMyBot } from "@/lib/me";

export const metadata: Metadata = { title: "Bot Forge" };

async function ForgeContent() {
  const { bot } = await requireMyBot("/me/forge");
  if (!bot) return <ContactOrganisers lead="Your account has no bot." />;
  // The account's saved character wins; with none, the forge falls back to the
  // copy kept in this browser, then to the one the name seeds.
  return <Forge name={bot.name} saved={bot.appearance} />;
}

export default function ForgePage() {
  return (
    <Suspense fallback={<Placeholder lines={8} />}>
      <ForgeContent />
    </Suspense>
  );
}
