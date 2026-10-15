import { signInWithGoogle } from "@/features/auth/actions";
import { SubmitButton } from "@/components/submit-button";

export function SignInButton({ next = "/me" }: { next?: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton pendingText="Opening Google…">Sign in with Google</SubmitButton>
    </form>
  );
}
