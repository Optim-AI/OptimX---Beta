/**
 * Email/password registration checks. Account creation itself goes through the
 * admin API so it does not send a Supabase confirmation email.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterInput = {
  email: string;
  password: string;
  businessName: string;
};

export type RegisterValidation =
  | { ok: true; value: RegisterInput }
  | { ok: false; error: string };

export function validateRegisterInput(body: unknown): RegisterValidation {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  const password = typeof raw.password === "string" ? raw.password : "";
  const businessName = typeof raw.businessName === "string" ? raw.businessName.trim() : "";

  if (!email) return { ok: false, error: "Please enter an email." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (!password) return { ok: false, error: "Please enter a password." };
  if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
  if (password.length > 128) return { ok: false, error: "Password is too long." };
  if (!businessName) return { ok: false, error: "Please enter your business name." };
  if (businessName.length > 200) return { ok: false, error: "Business name is too long." };

  return { ok: true, value: { email, password, businessName } };
}

export function isExistingAccountError(
  error: { message?: string; code?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = (error.code || "").toLowerCase();
  if (code === "email_exists" || code === "user_already_exists") return true;
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("user already exists")
  );
}
