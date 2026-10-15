export type SignInErrorKind = "domain" | "cancelled" | "expired" | "failed";

// Supabase hides the database's sign-up refusal behind this generic text.
const SIGNUP_REFUSED = /database error saving new user/i;

export function signInErrorKind(params: URLSearchParams): SignInErrorKind | null {
  const error = params.get("error");
  if (!error) return params.get("code") ? null : "expired";
  if (SIGNUP_REFUSED.test(params.get("error_description") ?? "")) return "domain";
  if (error === "access_denied") return "cancelled";
  return "failed";
}

export function signInErrorMessage(kind: string | undefined, domain: string | null): string | null {
  switch (kind) {
    case "domain":
      return domain ? `Papersseum is only open to @${domain} Google accounts.` : "This account can't sign up.";
    case "cancelled":
      return "Sign-in was cancelled.";
    case "expired":
      return "That sign-in link expired or was already used. Try again.";
    case "failed":
      return "Sign-in failed. Try again.";
    default:
      return null;
  }
}
