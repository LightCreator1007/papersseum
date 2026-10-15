import { redirect } from "next/navigation";
import { getMyBot } from "@/features/ladder/queries";
import { getUserId } from "@/lib/supabase/server";

// The signed-in user's bot, or a redirect to sign-in that comes back to `next`.
export async function requireMyBot(next: string) {
  const userId = await getUserId();
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  const bot = await getMyBot(userId);
  return { userId, bot };
}
