import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/auth/supabase/admin";
import { ProfileDAO } from "@/database";
import { isExistingAccountError, validateRegisterInput } from "@/lib/auth/register-account";

/**
 * Creates an email/password account and signs them in from the browser afterward.
 * Supabase's built-in mailer caps confirmation emails for the whole project per
 * hour. Client signUp hits that cap and keeps failing long after a minute, so
 * registration confirms the address here and does not send that email.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const validated = validateRegisterInput(req.body);
  if (!validated.ok) {
    return res.status(400).json({ ok: false, error: validated.error });
  }

  const { email, password, businessName } = validated.value;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { business_name: businessName },
  });

  if (error) {
    if (isExistingAccountError(error)) {
      return res.status(409).json({
        ok: false,
        code: "already_registered",
        error: "You already have an account with this email.",
      });
    }
    console.error("[register] createUser failed", error.code || "", error.message);
    const weak = /password/i.test(error.message || "");
    return res.status(400).json({
      ok: false,
      error: weak
        ? "Choose a stronger password — at least 6 characters."
        : "Could not create your account. Please try again.",
    });
  }

  const userId = data.user?.id;
  if (userId) {
    try {
      await ProfileDAO.upsert(userId, { email, businessName });
    } catch (err) {
      console.error("[register] profile update failed", (err as Error).message);
    }
  }

  return res.status(200).json({ ok: true });
}
