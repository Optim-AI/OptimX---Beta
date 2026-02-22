


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."decrement_credit"("p_user" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.user_credits
  SET credits = GREATEST(credits - 1, 0),
      updated_at = now()
  WHERE id = p_user;
END;
$$;


ALTER FUNCTION "public"."decrement_credit"("p_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, inserted_at)
  VALUES (
    NEW.id,
    NEW.email,
    (CASE WHEN NEW.raw_user_meta IS NOT NULL THEN NEW.raw_user_meta->>'full_name' ELSE NULL END),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN others THEN
  -- Ensure signup never fails because of profile creation issues
  RAISE NOTICE 'handle_new_auth_user exception: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_credits"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.user_credits (
    id, 
    credits, 
    image_credits_subscription, 
    image_credits_addon, 
    video_credits_subscription, 
    video_credits_addon
  )
  VALUES (NEW.id, 0, 0, 0, 0, 0)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_credits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_integrationsbeta_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- trim usernames so we treat "   " as empty
  if (new.instagram_username is null or btrim(new.instagram_username) = '')
     and (new.facebook_username is null or btrim(new.facebook_username) = '') then

    -- no usernames -> need_to_approve
    new.status := 'need_to_approve';

  elsif new.status is distinct from 'completed' then
    -- some username entered but not manually completed -> pending
    new.status := 'pending';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_integrationsbeta_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_profile"("p_id" "uuid", "p_payload" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, phone_verified, business_mobile, business_mobile_verified, location, business_name, business_type, business_size, use_case, color_primary, color_secondary, font, logo_path, ref_images, heard_from, heard_from_other)
  SELECT
    p_id,
    p_payload ->> 'full_name',
    p_payload ->> 'email',
    p_payload ->> 'phone',
    (p_payload ->> 'phone_verified')::boolean,
    p_payload ->> 'business_mobile',
    (p_payload ->> 'business_mobile_verified')::boolean,
    p_payload ->> 'location',
    p_payload ->> 'business_name',
    p_payload ->> 'business_type',
    p_payload ->> 'business_size',
    (CASE WHEN p_payload -> 'use_case' IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(p_payload -> 'use_case')) END),
    p_payload ->> 'color_primary',
    p_payload ->> 'color_secondary',
    p_payload ->> 'font',
    p_payload ->> 'logo_path',
    (CASE WHEN p_payload -> 'ref_images' IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(p_payload -> 'ref_images')) END),
    p_payload ->> 'heard_from',
    p_payload ->> 'heard_from_other'
  ON CONFLICT (id)
  DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    phone_verified = EXCLUDED.phone_verified,
    business_mobile = EXCLUDED.business_mobile,
    business_mobile_verified = EXCLUDED.business_mobile_verified,
    location = EXCLUDED.location,
    business_name = EXCLUDED.business_name,
    business_type = EXCLUDED.business_type,
    business_size = EXCLUDED.business_size,
    use_case = EXCLUDED.use_case,
    color_primary = EXCLUDED.color_primary,
    color_secondary = EXCLUDED.color_secondary,
    font = EXCLUDED.font,
    logo_path = EXCLUDED.logo_path,
    ref_images = EXCLUDED.ref_images,
    heard_from = EXCLUDED.heard_from,
    heard_from_other = EXCLUDED.heard_from_other,
    updated_at = now();
END;
$$;


ALTER FUNCTION "public"."upsert_profile"("p_id" "uuid", "p_payload" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ad_accounts" (
    "id" "uuid" NOT NULL,
    "integration_id" "uuid" NOT NULL,
    "account_id" "text" NOT NULL,
    "account_raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ad_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "audience" "text",
    "campaign_type" "text",
    "brand_voice" "text",
    "content_types" "text"[],
    "vision" "text",
    "output" "jsonb",
    "image_url" "text"[],
    "image_path" "text"[],
    "is_published" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creative_studio_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "session_type" "text" DEFAULT 'poster'::"text" NOT NULL,
    "brand_snapshot" "jsonb" NOT NULL,
    "phase" "text",
    "messages" "jsonb",
    "product_data" "jsonb",
    "poster_prompt" "text",
    "config" "jsonb",
    "generated_posters" "jsonb",
    "ad_builder_data" "jsonb",
    "generated_videos" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."creative_studio_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."creative_studio_sessions" IS 'Stores Creative Studio sessions for poster and video generation with full state persistence';



COMMENT ON COLUMN "public"."creative_studio_sessions"."session_type" IS 'Type of session: poster or video';



COMMENT ON COLUMN "public"."creative_studio_sessions"."phase" IS 'Current phase for poster sessions (input, analyzing, brand-review, product-input, poster-prompt, config, generating, ready)';



COMMENT ON COLUMN "public"."creative_studio_sessions"."messages" IS 'Array of chat messages for the session';



COMMENT ON COLUMN "public"."creative_studio_sessions"."poster_prompt" IS 'The prompt used for poster generation';



COMMENT ON COLUMN "public"."creative_studio_sessions"."generated_posters" IS 'Array of generated poster URLs/data';



COMMENT ON COLUMN "public"."creative_studio_sessions"."ad_builder_data" IS 'Video ad builder wizard state (product, setup, voiceover, etc.)';



COMMENT ON COLUMN "public"."creative_studio_sessions"."generated_videos" IS 'Array of generated video URLs/data';



CREATE TABLE IF NOT EXISTS "public"."credit_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credit_type" "text" NOT NULL,
    "amount" integer NOT NULL,
    "operation" "text" NOT NULL,
    "source" "text" NOT NULL,
    "balance_after" integer NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_history_credit_type_check" CHECK (("credit_type" = ANY (ARRAY['image'::"text", 'video'::"text"]))),
    CONSTRAINT "credit_history_operation_check" CHECK (("operation" = ANY (ARRAY['add'::"text", 'deduct'::"text", 'reset'::"text", 'expire'::"text"])))
);


ALTER TABLE "public"."credit_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."credit_packs" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "credit_type" "text" NOT NULL,
    "credits" integer NOT NULL,
    "price_inr" integer NOT NULL,
    "razorpay_item_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "credit_packs_credit_type_check" CHECK (("credit_type" = ANY (ARRAY['image'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."credit_packs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_keys" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feature_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_flags" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "flags" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "provider_user_id" "text",
    "ad_account_id" "text",
    "page_id" "text",
    "ig_user_id" "text",
    "access_token" "text",
    "refresh_token" "text",
    "token_expires_at" timestamp with time zone,
    "scopes" "text"[],
    "raw" "jsonb",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "health_status" "text" DEFAULT 'healthy'::"text",
    "health_error_message" "text",
    "last_health_check" timestamp with time zone
);


ALTER TABLE "public"."integrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."integrations"."health_status" IS 'Current health status of the integration: healthy, unhealthy, or unknown';



COMMENT ON COLUMN "public"."integrations"."health_error_message" IS 'Error message if health_status is unhealthy';



COMMENT ON COLUMN "public"."integrations"."last_health_check" IS 'Timestamp of the last health check performed';



CREATE TABLE IF NOT EXISTS "public"."integrationsbeta" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "instagram_username" "text",
    "facebook_username" "text",
    "email" "text",
    "mobile_number" "text",
    "status" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "business_page_id" "text"
);


ALTER TABLE "public"."integrationsbeta" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."oauth_sessions" (
    "id" "text" NOT NULL,
    "user_id" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."oauth_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."oauth_sessions" IS 'Temporary storage for OAuth session data during authentication flows';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "subscription_id" "uuid",
    "credit_pack_id" "text",
    "razorpay_payment_id" "text",
    "razorpay_order_id" "text",
    "razorpay_signature" "text",
    "amount" integer NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "status" "text" NOT NULL,
    "payment_type" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payments_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['subscription'::"text", 'image_topup'::"text", 'video_topup'::"text"]))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['created'::"text", 'captured'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "text" NOT NULL,
    "feature_key" "text" NOT NULL,
    "is_enabled" boolean DEFAULT false NOT NULL,
    "is_coming_soon" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."plan_feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "billing_cycle" "text" NOT NULL,
    "price_inr" integer DEFAULT 0 NOT NULL,
    "image_credits" integer DEFAULT 0 NOT NULL,
    "video_credits" integer DEFAULT 0 NOT NULL,
    "razorpay_plan_id" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "plans_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'trial'::"text"])))
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "business_name" "text",
    "email" "text",
    "phone" "text",
    "phone_verified" boolean DEFAULT false,
    "business_mobile" "text",
    "business_mobile_verified" boolean DEFAULT false,
    "location" "text",
    "business_type" "text",
    "business_size" "text",
    "use_case" "text"[],
    "color_primary" "text",
    "color_secondary" "text",
    "font" "text",
    "logo_path" "text",
    "ref_images" "text"[],
    "heard_from" "text",
    "heard_from_other" "text",
    "inserted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tagline" "text",
    "brand_snapshot" "jsonb",
    "organisation_name" "text",
    "gst_number" "text",
    "invoice_email" "text",
    "primary_goal" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."brand_snapshot" IS 'Stores the user brand snapshot for Creative Studio (name, description, audience, offering, tone, logo, colors, etc.)';



CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "page_url" "text",
    "images" "text"[],
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "text" NOT NULL,
    "status" "text" NOT NULL,
    "razorpay_subscription_id" "text",
    "razorpay_customer_id" "text",
    "current_period_start" timestamp with time zone NOT NULL,
    "current_period_end" timestamp with time zone NOT NULL,
    "trial_ends_at" timestamp with time zone,
    "next_reset_date" timestamp with time zone NOT NULL,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['trialing'::"text", 'active'::"text", 'cancelled'::"text", 'expired'::"text", 'past_due'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_artifacts" (
    "id" "uuid" NOT NULL,
    "chat_id" "uuid",
    "artifact_path" "text",
    "sample_tag" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."training_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_chats" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "messages" "jsonb" NOT NULL,
    "consent_for_training" boolean DEFAULT false,
    "sanitized" boolean DEFAULT false,
    "client_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_chats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_credits" (
    "id" "uuid" NOT NULL,
    "credits" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "image_credits_subscription" integer DEFAULT 0 NOT NULL,
    "image_credits_addon" integer DEFAULT 0 NOT NULL,
    "video_credits_subscription" integer DEFAULT 0 NOT NULL,
    "video_credits_addon" integer DEFAULT 0 NOT NULL,
    "last_reset_at" timestamp with time zone
);


ALTER TABLE "public"."user_credits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_generated_image" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "image_path" "text",
    "source" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_generated_image" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_generated_images" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "image_path" "text",
    "source" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_generated_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_ui_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "state" "jsonb" NOT NULL,
    "client_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_ui_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "razorpay_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "status" "text" NOT NULL,
    "error_message" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "webhook_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."webhook_events" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ad_accounts"
    ADD CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creative_studio_sessions"
    ADD CONSTRAINT "creative_studio_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_history"
    ADD CONSTRAINT "credit_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."credit_packs"
    ADD CONSTRAINT "credit_packs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feature_keys"
    ADD CONSTRAINT "feature_keys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_flags"
    ADD CONSTRAINT "integration_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_flags"
    ADD CONSTRAINT "integration_flags_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integrationsbeta"
    ADD CONSTRAINT "integrationsbeta_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."oauth_sessions"
    ADD CONSTRAINT "oauth_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_feature_flags"
    ADD CONSTRAINT "plan_feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_feature_flags"
    ADD CONSTRAINT "plan_feature_flags_plan_id_feature_key_key" UNIQUE ("plan_id", "feature_key");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_artifacts"
    ADD CONSTRAINT "training_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_chats"
    ADD CONSTRAINT "user_chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_generated_image"
    ADD CONSTRAINT "user_generated_image_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_generated_images"
    ADD CONSTRAINT "user_generated_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ui_state"
    ADD CONSTRAINT "user_ui_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ui_state"
    ADD CONSTRAINT "user_ui_state_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_razorpay_event_id_key" UNIQUE ("razorpay_event_id");



CREATE INDEX "idx_ad_accounts_integration_id" ON "public"."ad_accounts" USING "btree" ("integration_id");



CREATE INDEX "idx_campaigns_created_at" ON "public"."campaigns" USING "btree" ("created_at");



CREATE INDEX "idx_campaigns_user_id" ON "public"."campaigns" USING "btree" ("user_id");



CREATE INDEX "idx_creative_studio_sessions_session_type" ON "public"."creative_studio_sessions" USING "btree" ("session_type");



CREATE INDEX "idx_creative_studio_sessions_type" ON "public"."creative_studio_sessions" USING "btree" ("session_type");



CREATE INDEX "idx_creative_studio_sessions_user_id" ON "public"."creative_studio_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_creative_studio_sessions_user_type" ON "public"."creative_studio_sessions" USING "btree" ("user_id", "session_type");



CREATE INDEX "idx_credit_history_created" ON "public"."credit_history" USING "btree" ("created_at");



CREATE INDEX "idx_credit_history_user" ON "public"."credit_history" USING "btree" ("user_id");



CREATE INDEX "idx_integration_flags_user_id" ON "public"."integration_flags" USING "btree" ("user_id");



CREATE INDEX "idx_integrations_user_provider" ON "public"."integrations" USING "btree" ("user_id", "provider");



CREATE INDEX "idx_payments_razorpay" ON "public"."payments" USING "btree" ("razorpay_payment_id") WHERE ("razorpay_payment_id" IS NOT NULL);



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_payments_user" ON "public"."payments" USING "btree" ("user_id");



CREATE INDEX "idx_reports_created_at" ON "public"."reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reports_status" ON "public"."reports" USING "btree" ("status");



CREATE INDEX "idx_reports_user_id" ON "public"."reports" USING "btree" ("user_id");



CREATE INDEX "idx_subscriptions_next_reset" ON "public"."subscriptions" USING "btree" ("next_reset_date") WHERE ("status" = ANY (ARRAY['trialing'::"text", 'active'::"text"]));



CREATE INDEX "idx_subscriptions_razorpay" ON "public"."subscriptions" USING "btree" ("razorpay_subscription_id") WHERE ("razorpay_subscription_id" IS NOT NULL);



CREATE INDEX "idx_subscriptions_status" ON "public"."subscriptions" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_subscriptions_user_active" ON "public"."subscriptions" USING "btree" ("user_id") WHERE ("status" = ANY (ARRAY['trialing'::"text", 'active'::"text"]));



CREATE INDEX "idx_user_chats_user" ON "public"."user_chats" USING "btree" ("user_id");



CREATE INDEX "idx_user_generated_image_user_id" ON "public"."user_generated_image" USING "btree" ("user_id");



CREATE INDEX "idx_user_generated_images_user" ON "public"."user_generated_images" USING "btree" ("user_id");



CREATE INDEX "idx_user_ui_state_user" ON "public"."user_ui_state" USING "btree" ("user_id");



CREATE INDEX "idx_webhook_events_status" ON "public"."webhook_events" USING "btree" ("status");



CREATE INDEX "idx_webhook_events_type" ON "public"."webhook_events" USING "btree" ("event_type");



CREATE INDEX "oauth_sessions_expires_at_idx" ON "public"."oauth_sessions" USING "btree" ("expires_at");



CREATE INDEX "oauth_sessions_provider_idx" ON "public"."oauth_sessions" USING "btree" ("provider");



CREATE INDEX "oauth_sessions_user_id_idx" ON "public"."oauth_sessions" USING "btree" ("user_id");



CREATE INDEX "profiles_business_mobile_idx" ON "public"."profiles" USING "btree" ("business_mobile") WHERE ("business_mobile" IS NOT NULL);



CREATE UNIQUE INDEX "profiles_email_idx" ON "public"."profiles" USING "btree" ("email") WHERE ("email" IS NOT NULL);



CREATE INDEX "profiles_phone_idx" ON "public"."profiles" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_integrationsbeta_updated_at" BEFORE UPDATE ON "public"."integrationsbeta" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_plans_updated_at" BEFORE UPDATE ON "public"."plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_integrationsbeta_status" BEFORE INSERT OR UPDATE ON "public"."integrationsbeta" FOR EACH ROW EXECUTE FUNCTION "public"."set_integrationsbeta_status"();



CREATE OR REPLACE TRIGGER "trg_set_updated_at" BEFORE UPDATE ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_chats_updated_at" BEFORE UPDATE ON "public"."user_chats" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_generated_image_updated_at" BEFORE UPDATE ON "public"."user_generated_image" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_generated_images_updated_at" BEFORE UPDATE ON "public"."user_generated_images" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_user_ui_state_updated_at" BEFORE UPDATE ON "public"."user_ui_state" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."ad_accounts"
    ADD CONSTRAINT "ad_accounts_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."credit_history"
    ADD CONSTRAINT "credit_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integrationsbeta"
    ADD CONSTRAINT "integrationsbeta_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_credit_pack_id_fkey" FOREIGN KEY ("credit_pack_id") REFERENCES "public"."credit_packs"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_feature_flags"
    ADD CONSTRAINT "plan_feature_flags_feature_key_fkey" FOREIGN KEY ("feature_key") REFERENCES "public"."feature_keys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_feature_flags"
    ADD CONSTRAINT "plan_feature_flags_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."training_artifacts"
    ADD CONSTRAINT "training_artifacts_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."user_chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_credits"
    ADD CONSTRAINT "user_credits_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own sessions" ON "public"."creative_studio_sessions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own sessions" ON "public"."creative_studio_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own sessions" ON "public"."creative_studio_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own sessions" ON "public"."creative_studio_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."creative_studio_sessions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_credit"("p_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_credit"("p_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_credit"("p_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_credits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_integrationsbeta_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_integrationsbeta_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_integrationsbeta_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_profile"("p_id" "uuid", "p_payload" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_profile"("p_id" "uuid", "p_payload" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_profile"("p_id" "uuid", "p_payload" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."ad_accounts" TO "anon";
GRANT ALL ON TABLE "public"."ad_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."ad_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."creative_studio_sessions" TO "anon";
GRANT ALL ON TABLE "public"."creative_studio_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."creative_studio_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."credit_history" TO "anon";
GRANT ALL ON TABLE "public"."credit_history" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_history" TO "service_role";



GRANT ALL ON TABLE "public"."credit_packs" TO "anon";
GRANT ALL ON TABLE "public"."credit_packs" TO "authenticated";
GRANT ALL ON TABLE "public"."credit_packs" TO "service_role";



GRANT ALL ON TABLE "public"."feature_keys" TO "anon";
GRANT ALL ON TABLE "public"."feature_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_keys" TO "service_role";



GRANT ALL ON TABLE "public"."integration_flags" TO "anon";
GRANT ALL ON TABLE "public"."integration_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_flags" TO "service_role";



GRANT ALL ON TABLE "public"."integrations" TO "anon";
GRANT ALL ON TABLE "public"."integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."integrations" TO "service_role";



GRANT ALL ON TABLE "public"."integrationsbeta" TO "anon";
GRANT ALL ON TABLE "public"."integrationsbeta" TO "authenticated";
GRANT ALL ON TABLE "public"."integrationsbeta" TO "service_role";



GRANT ALL ON TABLE "public"."oauth_sessions" TO "anon";
GRANT ALL ON TABLE "public"."oauth_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."oauth_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."plan_feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."plan_feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."training_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."training_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."training_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."user_chats" TO "anon";
GRANT ALL ON TABLE "public"."user_chats" TO "authenticated";
GRANT ALL ON TABLE "public"."user_chats" TO "service_role";



GRANT ALL ON TABLE "public"."user_credits" TO "anon";
GRANT ALL ON TABLE "public"."user_credits" TO "authenticated";
GRANT ALL ON TABLE "public"."user_credits" TO "service_role";



GRANT ALL ON TABLE "public"."user_generated_image" TO "anon";
GRANT ALL ON TABLE "public"."user_generated_image" TO "authenticated";
GRANT ALL ON TABLE "public"."user_generated_image" TO "service_role";



GRANT ALL ON TABLE "public"."user_generated_images" TO "anon";
GRANT ALL ON TABLE "public"."user_generated_images" TO "authenticated";
GRANT ALL ON TABLE "public"."user_generated_images" TO "service_role";



GRANT ALL ON TABLE "public"."user_ui_state" TO "anon";
GRANT ALL ON TABLE "public"."user_ui_state" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ui_state" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_events" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







