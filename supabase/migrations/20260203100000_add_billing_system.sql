-- Billing System Migration
-- Date: 2026-02-03
-- Adds plans, subscriptions, payments, feature gating, and credit management

-- ============================================================
-- PLANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plans (
    id text PRIMARY KEY,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    description text,
    billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'trial')),
    price_inr integer NOT NULL DEFAULT 0,
    image_credits integer NOT NULL DEFAULT 0,
    video_credits integer NOT NULL DEFAULT 0, -- in seconds
    razorpay_plan_id text,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- FEATURE KEYS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feature_keys (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PLAN FEATURE FLAGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plan_feature_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id text NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    feature_key text NOT NULL REFERENCES public.feature_keys(id) ON DELETE CASCADE,
    is_enabled boolean NOT NULL DEFAULT false,
    is_coming_soon boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(plan_id, feature_key)
);

-- ============================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id text NOT NULL REFERENCES public.plans(id),
    status text NOT NULL CHECK (status IN ('trialing', 'active', 'cancelled', 'expired', 'past_due')),
    razorpay_subscription_id text,
    razorpay_customer_id text,
    current_period_start timestamptz NOT NULL,
    current_period_end timestamptz NOT NULL,
    trial_ends_at timestamptz,
    next_reset_date timestamptz NOT NULL,
    cancelled_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_subscriptions_user_active ON public.subscriptions(user_id) WHERE status IN ('trialing', 'active');
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_next_reset ON public.subscriptions(next_reset_date) WHERE status IN ('trialing', 'active');
CREATE INDEX idx_subscriptions_razorpay ON public.subscriptions(razorpay_subscription_id) WHERE razorpay_subscription_id IS NOT NULL;

-- ============================================================
-- CREDIT PACKS TABLE (for one-time purchases)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credit_packs (
    id text PRIMARY KEY,
    name text NOT NULL,
    credit_type text NOT NULL CHECK (credit_type IN ('image', 'video')),
    credits integer NOT NULL,
    price_inr integer NOT NULL,
    razorpay_item_id text,
    is_active boolean NOT NULL DEFAULT true,
    display_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    credit_pack_id text REFERENCES public.credit_packs(id) ON DELETE SET NULL,
    razorpay_payment_id text,
    razorpay_order_id text,
    razorpay_signature text,
    amount integer NOT NULL,
    currency text NOT NULL DEFAULT 'INR',
    status text NOT NULL CHECK (status IN ('created', 'captured', 'failed', 'refunded')),
    payment_type text NOT NULL CHECK (payment_type IN ('subscription', 'image_topup', 'video_topup')),
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_payments_user ON public.payments(user_id);
CREATE INDEX idx_payments_razorpay ON public.payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX idx_payments_status ON public.payments(status);

-- ============================================================
-- WEBHOOK EVENTS TABLE (idempotency)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    razorpay_event_id text NOT NULL UNIQUE,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'processed', 'failed')),
    error_message text,
    processed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_webhook_events_type ON public.webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON public.webhook_events(status);

-- ============================================================
-- CREDIT HISTORY TABLE (audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credit_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credit_type text NOT NULL CHECK (credit_type IN ('image', 'video')),
    amount integer NOT NULL,
    operation text NOT NULL CHECK (operation IN ('add', 'deduct', 'reset', 'expire')),
    source text NOT NULL,
    balance_after integer NOT NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_credit_history_user ON public.credit_history(user_id);
CREATE INDEX idx_credit_history_created ON public.credit_history(created_at);

-- ============================================================
-- UPDATE USER_CREDITS TABLE
-- Add separate image and video credit columns
-- ============================================================
ALTER TABLE public.user_credits 
ADD COLUMN IF NOT EXISTS image_credits_subscription integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_credits_addon integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_credits_subscription integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS video_credits_addon integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reset_at timestamptz;

-- ============================================================
-- SEED DATA: PLANS
-- ============================================================
INSERT INTO public.plans (id, name, slug, description, billing_cycle, price_inr, image_credits, video_credits, display_order) VALUES
('free_trial', 'Free Trial', 'free-trial', '5-day trial with limited credits', 'trial', 0, 5, 6, 0),
('basic_monthly', 'Basic', 'basic-monthly', 'Entry plan for image generation', 'monthly', 499, 15, 0, 1),
('basic_quarterly', 'Basic', 'basic-quarterly', 'Entry plan - 3 month', 'quarterly', 1449, 15, 0, 2),
('starter_monthly', 'Starter', 'starter-monthly', 'Creator plan with video support', 'monthly', 1499, 20, 30, 3),
('starter_quarterly', 'Starter', 'starter-quarterly', 'Creator plan - 3 month', 'quarterly', 4197, 20, 30, 4),
('lite_growth_monthly', 'Lite Growth', 'lite-growth-monthly', 'Small teams & SMBs', 'monthly', 599, 30, 20, 5),
('lite_growth_quarterly', 'Lite Growth', 'lite-growth-quarterly', 'Small teams - 3 month', 'quarterly', 1749, 30, 20, 6),
('growth_pro_monthly', 'Growth Pro', 'growth-pro-monthly', 'In-house marketing teams', 'monthly', 2199, 30, 50, 7),
('growth_pro_quarterly', 'Growth Pro', 'growth-pro-quarterly', 'Growth Pro - 3 month', 'quarterly', 6399, 30, 50, 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: FEATURE KEYS
-- ============================================================
INSERT INTO public.feature_keys (id, name, description, category) VALUES
('image_generation', 'Image Generation', 'Create image/poster ads', 'generation'),
('video_generation', 'Video Generation', 'Create video ads', 'generation'),
('no_watermark', 'No Watermark', 'Remove Oli AI watermark from outputs', 'generation'),
('fast_generation', 'Fast Generation', 'Standard speed processing', 'generation'),
('priority_generation', 'Priority Generation', 'Priority queue processing', 'generation'),
('basic_analytics', 'Basic Analytics', 'Basic campaign insights', 'analytics'),
('advanced_analytics', 'Advanced Analytics', 'Full analytics dashboard', 'analytics'),
('social_posting', 'Social Posting', 'Manual social media posting', 'posting'),
('auto_scheduling', 'Auto Scheduling', 'Automated post scheduling', 'posting'),
('brand_analysis', 'Brand Analysis', 'Brand performance analysis', 'analysis'),
('competitive_analysis', 'Competitive Analysis', 'Competitor tracking', 'analysis'),
('dashboard', 'Dashboard', 'Main dashboard view', 'navigation'),
('integrations', 'Integrations', 'Platform integrations', 'navigation'),
('create_campaigns', 'Create Campaigns', 'Campaign creation flow', 'navigation'),
('campaign_library', 'Campaign Library', 'Campaign management', 'navigation')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SEED DATA: PLAN FEATURE FLAGS
-- ============================================================

-- Free Trial features
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('free_trial', 'image_generation', true, false),
('free_trial', 'video_generation', true, false),
('free_trial', 'no_watermark', false, false),
('free_trial', 'fast_generation', false, false),
('free_trial', 'priority_generation', false, false),
('free_trial', 'basic_analytics', false, true),
('free_trial', 'advanced_analytics', false, true),
('free_trial', 'social_posting', false, false),
('free_trial', 'auto_scheduling', false, false),
('free_trial', 'brand_analysis', false, false),
('free_trial', 'competitive_analysis', false, false),
('free_trial', 'dashboard', false, false),
('free_trial', 'integrations', false, false),
('free_trial', 'create_campaigns', false, false),
('free_trial', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Basic Monthly features
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('basic_monthly', 'image_generation', true, false),
('basic_monthly', 'video_generation', false, false),
('basic_monthly', 'no_watermark', true, false),
('basic_monthly', 'fast_generation', false, false),
('basic_monthly', 'priority_generation', false, false),
('basic_monthly', 'basic_analytics', false, true),
('basic_monthly', 'advanced_analytics', false, true),
('basic_monthly', 'social_posting', false, false),
('basic_monthly', 'auto_scheduling', false, false),
('basic_monthly', 'brand_analysis', false, false),
('basic_monthly', 'competitive_analysis', false, false),
('basic_monthly', 'dashboard', false, false),
('basic_monthly', 'integrations', false, false),
('basic_monthly', 'create_campaigns', false, false),
('basic_monthly', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Basic Quarterly (same as monthly)
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('basic_quarterly', 'image_generation', true, false),
('basic_quarterly', 'video_generation', false, false),
('basic_quarterly', 'no_watermark', true, false),
('basic_quarterly', 'fast_generation', false, false),
('basic_quarterly', 'priority_generation', false, false),
('basic_quarterly', 'basic_analytics', false, true),
('basic_quarterly', 'advanced_analytics', false, true),
('basic_quarterly', 'social_posting', false, false),
('basic_quarterly', 'auto_scheduling', false, false),
('basic_quarterly', 'brand_analysis', false, false),
('basic_quarterly', 'competitive_analysis', false, false),
('basic_quarterly', 'dashboard', false, false),
('basic_quarterly', 'integrations', false, false),
('basic_quarterly', 'create_campaigns', false, false),
('basic_quarterly', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Starter Monthly features
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('starter_monthly', 'image_generation', true, false),
('starter_monthly', 'video_generation', true, false),
('starter_monthly', 'no_watermark', true, false),
('starter_monthly', 'fast_generation', true, false),
('starter_monthly', 'priority_generation', false, false),
('starter_monthly', 'basic_analytics', false, true),
('starter_monthly', 'advanced_analytics', false, true),
('starter_monthly', 'social_posting', false, false),
('starter_monthly', 'auto_scheduling', false, false),
('starter_monthly', 'brand_analysis', false, false),
('starter_monthly', 'competitive_analysis', false, false),
('starter_monthly', 'dashboard', false, false),
('starter_monthly', 'integrations', false, false),
('starter_monthly', 'create_campaigns', false, false),
('starter_monthly', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Starter Quarterly (same as monthly)
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('starter_quarterly', 'image_generation', true, false),
('starter_quarterly', 'video_generation', true, false),
('starter_quarterly', 'no_watermark', true, false),
('starter_quarterly', 'fast_generation', true, false),
('starter_quarterly', 'priority_generation', false, false),
('starter_quarterly', 'basic_analytics', false, true),
('starter_quarterly', 'advanced_analytics', false, true),
('starter_quarterly', 'social_posting', false, false),
('starter_quarterly', 'auto_scheduling', false, false),
('starter_quarterly', 'brand_analysis', false, false),
('starter_quarterly', 'competitive_analysis', false, false),
('starter_quarterly', 'dashboard', false, false),
('starter_quarterly', 'integrations', false, false),
('starter_quarterly', 'create_campaigns', false, false),
('starter_quarterly', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Lite Growth Monthly features
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('lite_growth_monthly', 'image_generation', true, false),
('lite_growth_monthly', 'video_generation', true, false),
('lite_growth_monthly', 'no_watermark', true, false),
('lite_growth_monthly', 'fast_generation', false, false),
('lite_growth_monthly', 'priority_generation', false, false),
('lite_growth_monthly', 'basic_analytics', false, true),
('lite_growth_monthly', 'advanced_analytics', false, true),
('lite_growth_monthly', 'social_posting', false, true),
('lite_growth_monthly', 'auto_scheduling', false, false),
('lite_growth_monthly', 'brand_analysis', false, false),
('lite_growth_monthly', 'competitive_analysis', false, false),
('lite_growth_monthly', 'dashboard', false, false),
('lite_growth_monthly', 'integrations', false, false),
('lite_growth_monthly', 'create_campaigns', false, false),
('lite_growth_monthly', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Lite Growth Quarterly (same as monthly)
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('lite_growth_quarterly', 'image_generation', true, false),
('lite_growth_quarterly', 'video_generation', true, false),
('lite_growth_quarterly', 'no_watermark', true, false),
('lite_growth_quarterly', 'fast_generation', false, false),
('lite_growth_quarterly', 'priority_generation', false, false),
('lite_growth_quarterly', 'basic_analytics', false, true),
('lite_growth_quarterly', 'advanced_analytics', false, true),
('lite_growth_quarterly', 'social_posting', false, true),
('lite_growth_quarterly', 'auto_scheduling', false, false),
('lite_growth_quarterly', 'brand_analysis', false, false),
('lite_growth_quarterly', 'competitive_analysis', false, false),
('lite_growth_quarterly', 'dashboard', false, false),
('lite_growth_quarterly', 'integrations', false, false),
('lite_growth_quarterly', 'create_campaigns', false, false),
('lite_growth_quarterly', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Growth Pro Monthly features
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('growth_pro_monthly', 'image_generation', true, false),
('growth_pro_monthly', 'video_generation', true, false),
('growth_pro_monthly', 'no_watermark', true, false),
('growth_pro_monthly', 'fast_generation', true, false),
('growth_pro_monthly', 'priority_generation', true, false),
('growth_pro_monthly', 'basic_analytics', false, true),
('growth_pro_monthly', 'advanced_analytics', false, true),
('growth_pro_monthly', 'social_posting', false, true),
('growth_pro_monthly', 'auto_scheduling', false, true),
('growth_pro_monthly', 'brand_analysis', false, true),
('growth_pro_monthly', 'competitive_analysis', false, true),
('growth_pro_monthly', 'dashboard', false, false),
('growth_pro_monthly', 'integrations', false, false),
('growth_pro_monthly', 'create_campaigns', false, false),
('growth_pro_monthly', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- Growth Pro Quarterly (same as monthly)
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('growth_pro_quarterly', 'image_generation', true, false),
('growth_pro_quarterly', 'video_generation', true, false),
('growth_pro_quarterly', 'no_watermark', true, false),
('growth_pro_quarterly', 'fast_generation', true, false),
('growth_pro_quarterly', 'priority_generation', true, false),
('growth_pro_quarterly', 'basic_analytics', false, true),
('growth_pro_quarterly', 'advanced_analytics', false, true),
('growth_pro_quarterly', 'social_posting', false, true),
('growth_pro_quarterly', 'auto_scheduling', false, true),
('growth_pro_quarterly', 'brand_analysis', false, true),
('growth_pro_quarterly', 'competitive_analysis', false, true),
('growth_pro_quarterly', 'dashboard', false, false),
('growth_pro_quarterly', 'integrations', false, false),
('growth_pro_quarterly', 'create_campaigns', false, false),
('growth_pro_quarterly', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- ============================================================
-- SEED DATA: CREDIT PACKS
-- ============================================================
INSERT INTO public.credit_packs (id, name, credit_type, credits, price_inr, display_order) VALUES
('image_10', '10 Image Credits', 'image', 10, 199, 1),
('image_25', '25 Image Credits', 'image', 25, 449, 2),
('video_30', '30 Second Video Credits', 'video', 30, 450, 3),
('video_60', '60 Second Video Credits', 'video', 60, 850, 4),
('video_100', '100 Second Video Credits', 'video', 100, 1300, 5)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Updated at triggers
DROP TRIGGER IF EXISTS trg_plans_updated_at ON public.plans;
CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- UPDATE NEW USER TRIGGER
-- Now creates credits with separate image/video fields
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
$function$;
