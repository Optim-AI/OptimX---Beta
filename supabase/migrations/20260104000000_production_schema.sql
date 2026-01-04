-- Production Schema Migration
-- Generated from production database: jjfoymnhchfpjstomipr
-- Date: 2026-01-04

-- ============================================================
-- TABLES
-- ============================================================

-- ad_accounts
CREATE TABLE IF NOT EXISTS public.ad_accounts (
    id uuid NOT NULL,
    integration_id uuid NOT NULL,
    account_id text NOT NULL,
    account_raw jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT ad_accounts_pkey PRIMARY KEY (id)
);

-- app_settings
CREATE TABLE IF NOT EXISTS public.app_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT app_settings_pkey PRIMARY KEY (key)
);

-- campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text,
    audience text,
    campaign_type text,
    brand_voice text,
    content_types text[],
    vision text,
    output jsonb,
    image_url text[],
    image_path text[],
    is_published boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);

-- integration_flags
CREATE TABLE IF NOT EXISTS public.integration_flags (
    id uuid NOT NULL,
    user_id uuid,
    flags jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT integration_flags_pkey PRIMARY KEY (id),
    CONSTRAINT integration_flags_user_unique UNIQUE (user_id)
);

-- integrations
CREATE TABLE IF NOT EXISTS public.integrations (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    provider_user_id text,
    ad_account_id text,
    page_id text,
    ig_user_id text,
    access_token text,
    refresh_token text,
    token_expires_at timestamptz,
    scopes text[],
    raw jsonb,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT integrations_pkey PRIMARY KEY (id)
);

-- integrationsbeta
CREATE TABLE IF NOT EXISTS public.integrationsbeta (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    instagram_username text,
    facebook_username text,
    email text,
    mobile_number text,
    status text NOT NULL,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    business_page_id text,
    CONSTRAINT integrationsbeta_pkey PRIMARY KEY (id)
);

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL,
    full_name text,
    business_name text,
    email text,
    phone text,
    phone_verified boolean DEFAULT false,
    business_mobile text,
    business_mobile_verified boolean DEFAULT false,
    location text,
    business_type text,
    business_size text,
    use_case text[],
    color_primary text,
    color_secondary text,
    font text,
    logo_path text,
    ref_images text[],
    heard_from text,
    heard_from_other text,
    inserted_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    tagline text,
    CONSTRAINT profiles_pkey PRIMARY KEY (id)
);

-- training_artifacts
CREATE TABLE IF NOT EXISTS public.training_artifacts (
    id uuid NOT NULL,
    chat_id uuid,
    artifact_path text,
    sample_tag text,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT training_artifacts_pkey PRIMARY KEY (id)
);

-- user_chats
CREATE TABLE IF NOT EXISTS public.user_chats (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text,
    messages jsonb NOT NULL,
    consent_for_training boolean DEFAULT false,
    sanitized boolean DEFAULT false,
    client_version text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT user_chats_pkey PRIMARY KEY (id)
);

-- user_credits
CREATE TABLE IF NOT EXISTS public.user_credits (
    id uuid NOT NULL,
    credits integer NOT NULL DEFAULT 0,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT user_credits_pkey PRIMARY KEY (id)
);

-- user_generated_image
CREATE TABLE IF NOT EXISTS public.user_generated_image (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    image_url text NOT NULL,
    image_path text,
    source text,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT user_generated_image_pkey PRIMARY KEY (id)
);

-- user_generated_images
CREATE TABLE IF NOT EXISTS public.user_generated_images (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    image_url text NOT NULL,
    image_path text,
    source text NOT NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT user_generated_images_pkey PRIMARY KEY (id)
);

-- user_ui_state
CREATE TABLE IF NOT EXISTS public.user_ui_state (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    state jsonb NOT NULL,
    client_version text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT user_ui_state_pkey PRIMARY KEY (id),
    CONSTRAINT user_ui_state_user_id_key UNIQUE (user_id)
);

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE public.ad_accounts
    ADD CONSTRAINT ad_accounts_integration_id_fkey
    FOREIGN KEY (integration_id) REFERENCES public.integrations(id) ON DELETE CASCADE;

ALTER TABLE public.campaigns
    ADD CONSTRAINT campaigns_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.integrationsbeta
    ADD CONSTRAINT integrationsbeta_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.training_artifacts
    ADD CONSTRAINT training_artifacts_chat_id_fkey
    FOREIGN KEY (chat_id) REFERENCES public.user_chats(id) ON DELETE CASCADE;

ALTER TABLE public.user_credits
    ADD CONSTRAINT user_credits_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ad_accounts_integration_id ON public.ad_accounts USING btree (integration_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON public.campaigns USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_integration_flags_user_id ON public.integration_flags USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_provider ON public.integrations USING btree (user_id, provider);
CREATE INDEX IF NOT EXISTS profiles_business_mobile_idx ON public.profiles USING btree (business_mobile) WHERE (business_mobile IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles USING btree (email) WHERE (email IS NOT NULL);
CREATE INDEX IF NOT EXISTS profiles_phone_idx ON public.profiles USING btree (phone) WHERE (phone IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_user_chats_user ON public.user_chats USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_generated_image_user_id ON public.user_generated_image USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_generated_images_user ON public.user_generated_images USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_ui_state_user ON public.user_ui_state USING btree (user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- decrement_credit
CREATE OR REPLACE FUNCTION public.decrement_credit(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.user_credits
  SET credits = GREATEST(credits - 1, 0),
      updated_at = now()
  WHERE id = p_user;
END;
$function$;

-- handle_new_auth_user
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- handle_new_user_credits
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_credits (id, credits)
  VALUES (NEW.id, 10)  -- 👈 starting credits (change this to 20, 30, 100 anytime)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- set_integrationsbeta_status
CREATE OR REPLACE FUNCTION public.set_integrationsbeta_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
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
$function$;

-- set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- upsert_profile
CREATE OR REPLACE FUNCTION public.upsert_profile(p_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;

-- ============================================================
-- TRIGGERS ON auth.users (Supabase Auth)
-- ============================================================

-- Trigger to create profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Trigger to create user_credits on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- ============================================================
-- TRIGGERS ON public tables
-- ============================================================

DROP TRIGGER IF EXISTS trg_set_updated_at ON public.campaigns;
CREATE TRIGGER trg_set_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_integrationsbeta_updated_at ON public.integrationsbeta;
CREATE TRIGGER trg_integrationsbeta_updated_at
  BEFORE UPDATE ON public.integrationsbeta
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_integrationsbeta_status ON public.integrationsbeta;
CREATE TRIGGER trg_set_integrationsbeta_status
  BEFORE INSERT OR UPDATE ON public.integrationsbeta
  FOR EACH ROW EXECUTE FUNCTION set_integrationsbeta_status();

DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_chats_updated_at ON public.user_chats;
CREATE TRIGGER trg_user_chats_updated_at
  BEFORE UPDATE ON public.user_chats
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_generated_image_updated_at ON public.user_generated_image;
CREATE TRIGGER trg_user_generated_image_updated_at
  BEFORE UPDATE ON public.user_generated_image
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_generated_images_updated_at ON public.user_generated_images;
CREATE TRIGGER trg_user_generated_images_updated_at
  BEFORE UPDATE ON public.user_generated_images
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_user_ui_state_updated_at ON public.user_ui_state;
CREATE TRIGGER trg_user_ui_state_updated_at
  BEFORE UPDATE ON public.user_ui_state
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
