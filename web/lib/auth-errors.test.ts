import { describe, expect, it } from "vitest";
import { signInErrorKind, signInErrorMessage } from "@/lib/auth-errors";

const params = (q: string) => new URLSearchParams(q);

describe("signInErrorKind", () => {
  it("is null for a normal return with a code", () => {
    expect(signInErrorKind(params("code=abc&next=/me"))).toBeNull();
  });
  it("spots the database refusing a non-college account", () => {
    expect(signInErrorKind(params("error=server_error&error_description=Database+error+saving+new+user"))).toBe("domain");
  });
  it("spots a cancelled Google prompt", () => {
    expect(signInErrorKind(params("error=access_denied&error_description=The+user+denied"))).toBe("cancelled");
  });
  it("treats a missing code as an expired link", () => {
    expect(signInErrorKind(params("next=/me"))).toBe("expired");
  });
  it("treats any other error as a failure", () => {
    expect(signInErrorKind(params("error=server_error&error_description=Something+else"))).toBe("failed");
  });
});

describe("signInErrorMessage", () => {
  it("names the allowed domain", () => {
    expect(signInErrorMessage("domain", "iiitdmj.ac.in")).toBe("Papersseum is only open to @iiitdmj.ac.in Google accounts.");
  });
  it("has a message for each kind and nothing for unknown values", () => {
    expect(signInErrorMessage("cancelled", null)).toBe("Sign-in was cancelled.");
    expect(signInErrorMessage("expired", null)).toBe("That sign-in link expired or was already used. Try again.");
    expect(signInErrorMessage("failed", null)).toBe("Sign-in failed. Try again.");
    expect(signInErrorMessage("<script>", null)).toBeNull();
    expect(signInErrorMessage(undefined, null)).toBeNull();
  });
});
