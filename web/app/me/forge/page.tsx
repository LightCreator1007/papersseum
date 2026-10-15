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
  // `saved` stays null until the bots.appearance column ships (ask A1); the forge
  // then keeps the design in the browser.
  return <Forge name={bot.name} saved={null} />;
}

export default function ForgePage() {
  return (
    <Suspense fallback={<Placeholder lines={8} />}>
      <ForgeContent />
    </Suspense>
  );
}
