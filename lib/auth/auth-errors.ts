/**
 * Supabase auth errors → what the person should do next. Supabase deliberately
 * answers "Invalid login credentials" for both an unknown email and a wrong
 * password, so sign-in offers both paths instead of guessing.
 */

export type AuthErrorKind =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "already_registered"
  | "rate_limited"
  | "weak_password"
  | "network"
  | "other";

export function classifyAuthError(error: unknown): AuthErrorKind {
  const msg = (error instanceof Error ? error.message : typeof error === "string" ? error : (error as { message?: string })?.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "invalid_credentials";
  if (msg.includes("email not confirmed")) return "email_not_confirmed";
  if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("user already exists")) return "already_registered";
  if (msg.includes("rate limit") || msg.includes("for security purposes") || msg.includes("too many")) return "rate_limited";
  if (msg.includes("password should") || msg.includes("weak password")) return "weak_password";
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed")) return "network";
  return "other";
}

export function authErrorMessage(error: unknown): string {
  switch (classifyAuthError(error)) {
    case "invalid_credentials":
      return "That email and password don't match an account.";
    case "email_not_confirmed":
      return "Confirm your email first — open the link we sent you, then log in.";
    case "already_registered":
      return "You already have an account with this email.";
    case "rate_limited":
      return "Too many attempts. Wait a minute, then try again.";
    case "weak_password":
      return "Choose a stronger password — at least 6 characters, ideally more.";
    case "network":
      return "We can't reach SkalX right now. Check your connection and try again.";
    default: {
      const raw = error instanceof Error ? error.message : typeof error === "string" ? error : (error as { message?: string })?.message;
      return raw?.trim() || "Something went wrong. Please try again.";
    }
  }
}
