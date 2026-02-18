-- Add workspace onboarding columns to profiles
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "invoice_email" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "gst_number" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "primary_goal" text;
