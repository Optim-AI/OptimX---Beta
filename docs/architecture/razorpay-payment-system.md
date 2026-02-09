# OptimX Payment & Billing System - Architecture Document

> **Version:** 1.0  
> **Last Updated:** February 3, 2026  
> **Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Plan Definitions](#3-plan-definitions)
4. [Database Architecture](#4-database-architecture)
5. [Feature Gating System](#5-feature-gating-system)
6. [API Architecture](#6-api-architecture)
7. [Webhook Processing](#7-webhook-processing)
8. [Credit Management System](#8-credit-management-system)
9. [Scheduled Jobs](#9-scheduled-jobs)
10. [Frontend Integration](#10-frontend-integration)
11. [Security Considerations](#11-security-considerations)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Executive Summary

### 1.1 Objective

Enable OptimX users to subscribe to paid plans via Razorpay, with:
- Monthly and 3-Month billing cycles
- Separate image and video credit tracking
- One-time credit top-up purchases
- Feature gating based on subscription plan
- Monthly credit resets via scheduled jobs

### 1.2 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Payment Provider | Razorpay | Indian market focus, GST compliance |
| Credit Reset | Scheduled Job | Predictable monthly resets independent of payment |
| Feature Gating | Database-driven flags | Flexible, no deployment needed |
| Plan Switching | Not supported (Phase 1) | Simplify initial implementation |
| Emails | Razorpay-handled | Leverage built-in invoice/notification system |

### 1.3 Out of Scope (Phase 1)

- Plan upgrades/downgrades mid-cycle
- Credit rollover
- Wallet system
- Annual plans
- Coupon codes
- Automatic refunds
- Custom email notifications from OptimX

---

## 2. System Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Next.js)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Plan Selection  │  Checkout Modal  │  Credit Display  │  Feature Gates    │
└────────┬─────────┴────────┬─────────┴────────┬─────────┴────────┬──────────┘
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            API LAYER (Next.js API Routes)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/subscriptions/*  │  /api/payments/*  │  /api/credits/*  │  /api/features/* │
└────────┬───────────────┴────────┬──────────┴────────┬─────────┴────────┬────┘
         │                        │                   │                  │
         ▼                        ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  SubscriptionService  │  PaymentService  │  CreditService  │  FeatureService │
└────────┬──────────────┴────────┬─────────┴────────┬────────┴────────┬───────┘
         │                       │                  │                 │
         ▼                       ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA ACCESS LAYER (DAOs)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  SubscriptionDAO  │  PaymentDAO  │  CreditDAO  │  PlanDAO  │  FeatureDAO    │
└────────┬──────────┴────────┬─────┴────────┬─────┴─────┬─────┴────────┬──────┘
         │                   │              │           │              │
         ▼                   ▼              ▼           ▼              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE (Supabase PostgreSQL)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  subscriptions  │  payments  │  user_credits  │  plans  │  feature_flags   │
└─────────────────┴────────────┴────────────────┴─────────┴──────────────────┘

         ▲                                    
         │ Webhooks                           
         │                                    
┌────────┴────────┐     ┌─────────────────┐
│    Razorpay     │     │  Cron Scheduler │
│  (Subscriptions │     │  (Credit Reset) │
│   & Payments)   │     │                 │
└─────────────────┘     └─────────────────┘
```

### 2.2 Core Flows

#### Flow 1: New User Signup with Plan Selection
```
User Signup → Plan Selection Page → Razorpay Checkout → 
Webhook: payment.captured → Create Subscription Record → 
Initialize Credits → Redirect to Creative Studio
```

#### Flow 2: Credit Consumption
```
User Action (Generate Image/Video) → Check Credit Balance → 
Deduct from Subscription Credits First → Then Addon Credits → 
Update Balance → Return Result
```

#### Flow 3: Credit Top-Up Purchase
```
User Clicks "Buy Credits" → Razorpay One-Time Payment → 
Webhook: payment.captured → Add to Addon Credits → 
Update Balance Display
```

#### Flow 4: Monthly Credit Reset
```
Scheduled Job (Daily) → Find Subscriptions Due for Reset → 
Reset Subscription Credits to Plan Defaults → 
Log Reset Event → Update next_reset_date
```

---

## 3. Plan Definitions

### 3.1 Plan Matrix

| Plan | Monthly Price | 3-Month Price | Image Credits | Video Credits | Billing |
|------|---------------|---------------|---------------|---------------|---------|
| Free Trial | ₹0 | N/A | 5 | 6 sec | 5 days |
| Basic | ₹499 | ₹1,449 | 15 | 0 | Monthly reset |
| Starter | ₹1,499 | ₹4,197 | 20 | 30 sec | Monthly reset |
| Lite Growth | ₹599 | ₹1,749 | 30 | 20 sec | Monthly reset |
| Growth Pro | ₹2,199 | ₹6,399 | 30 | 50 sec | Monthly reset |

### 3.2 Credit Top-Up Pricing

#### Image Credit Packs
| Pack | Credits | Price |
|------|---------|-------|
| Small | 10 | ₹199 |
| Medium | 25 | ₹449 |

#### Video Credit Packs
| Pack | Seconds | Price |
|------|---------|-------|
| Small | 30 | ₹450 |
| Medium | 60 | ₹850 |
| Large | 100 | ₹1,300 |

### 3.3 Plan Identifiers

Each plan variant needs a unique identifier for Razorpay:

```
plan_free_trial
plan_basic_monthly
plan_basic_quarterly
plan_starter_monthly
plan_starter_quarterly
plan_lite_growth_monthly
plan_lite_growth_quarterly
plan_growth_pro_monthly
plan_growth_pro_quarterly
```

---

## 4. Database Architecture

### 4.1 Entity Relationship Diagram

```
┌──────────────────┐       ┌──────────────────┐
│      plans       │       │   feature_keys   │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ name             │       │ key              │
│ slug             │       │ name             │
│ billing_cycle    │       │ description      │
│ price_inr        │       │ category         │
│ image_credits    │◄──────┤                  │
│ video_credits    │       └──────────────────┘
│ razorpay_plan_id │               │
│ is_active        │               │
└────────┬─────────┘               │
         │                         │
         │                         ▼
         │              ┌──────────────────────┐
         │              │  plan_feature_flags  │
         │              ├──────────────────────┤
         │              │ id (PK)              │
         └─────────────►│ plan_id (FK)         │
                        │ feature_key (FK)     │
                        │ is_enabled           │
                        │ is_coming_soon       │
                        └──────────────────────┘

┌──────────────────┐       ┌──────────────────┐
│  subscriptions   │       │    payments      │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ user_id (FK)     │       │ user_id (FK)     │
│ plan_id (FK)     │       │ subscription_id  │
│ status           │       │ razorpay_payment │
│ razorpay_sub_id  │       │ razorpay_order   │
│ current_period_  │       │ amount           │
│   start          │       │ currency         │
│ current_period_  │       │ status           │
│   end            │       │ payment_type     │
│ trial_ends_at    │       │ credit_pack_id   │
│ next_reset_date  │       │ created_at       │
│ created_at       │       └──────────────────┘
│ updated_at       │
└────────┬─────────┘
         │
         │
         ▼
┌──────────────────┐       ┌──────────────────┐
│   user_credits   │       │  credit_packs    │
├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │
│ user_id (FK)     │       │ type (image/     │
│ image_credits_   │       │   video)         │
│   subscription   │       │ credits          │
│ image_credits_   │       │ price_inr        │
│   addon          │       │ razorpay_item_id │
│ video_credits_   │       │ is_active        │
│   subscription   │       └──────────────────┘
│ video_credits_   │
│   addon          │
│ last_reset_at    │
│ updated_at       │
└──────────────────┘

┌──────────────────┐
│  credit_history  │
├──────────────────┤
│ id (PK)          │
│ user_id (FK)     │
│ credit_type      │
│ amount           │
│ operation        │
│ source           │
│ balance_after    │
│ metadata         │
│ created_at       │
└──────────────────┘

┌──────────────────┐
│ webhook_events   │
├──────────────────┤
│ id (PK)          │
│ razorpay_event_id│
│ event_type       │
│ payload          │
│ processed_at     │
│ status           │
│ error_message    │
│ created_at       │
└──────────────────┘
```

### 4.2 Table Descriptions

| Table | Purpose |
|-------|---------|
| `plans` | Master list of all subscription plans with pricing and credit allocations |
| `feature_keys` | Registry of all gatable features in the system |
| `plan_feature_flags` | Maps which features are enabled/disabled/coming-soon per plan |
| `subscriptions` | User subscription records with Razorpay references |
| `payments` | All payment transactions (subscriptions + one-time) |
| `user_credits` | Current credit balances per user (subscription + addon) |
| `credit_packs` | Available credit top-up packages |
| `credit_history` | Audit log of all credit changes |
| `webhook_events` | Razorpay webhook idempotency and debugging |

---

## 5. Feature Gating System

### 5.1 Feature Key Registry

All gatable features have a unique key:

| Feature Key | Category | Description |
|-------------|----------|-------------|
| `image_generation` | generation | Create image/poster ads |
| `video_generation` | generation | Create video ads |
| `no_watermark` | generation | Remove OptimX watermark |
| `fast_generation` | generation | Standard speed processing |
| `priority_generation` | generation | Priority queue processing |
| `basic_analytics` | analytics | Basic campaign insights |
| `advanced_analytics` | analytics | Full analytics dashboard |
| `social_posting` | posting | Manual social media posting |
| `auto_scheduling` | posting | Automated post scheduling |
| `brand_analysis` | analysis | Brand performance analysis |
| `competitive_analysis` | analysis | Competitor tracking |
| `dashboard` | navigation | Main dashboard view |
| `integrations` | navigation | Platform integrations |
| `create_campaigns` | navigation | Campaign creation flow |
| `campaign_library` | navigation | Campaign management |

### 5.2 Feature States

Each feature can be in one of three states:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ENABLED   │     │  DISABLED   │     │ COMING_SOON │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ Full access │     │ No access   │     │ Visible but │
│ to feature  │     │ Hidden or   │     │ locked with │
│             │     │ blocked     │     │ upgrade CTA │
└─────────────┘     └─────────────┘     └─────────────┘
```

### 5.3 Feature Access Matrix

| Feature | Free Trial | Basic | Starter | Lite Growth | Growth Pro |
|---------|------------|-------|---------|-------------|------------|
| `image_generation` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `video_generation` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `no_watermark` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `fast_generation` | ❌ | ❌ | ✅ | ❌ | ✅ |
| `priority_generation` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `basic_analytics` | 🔜 | 🔜 | 🔜 | 🔜 | 🔜 |
| `advanced_analytics` | 🔜 | 🔜 | 🔜 | 🔜 | 🔜 |
| `social_posting` | ❌ | ❌ | ❌ | 🔜 | 🔜 |
| `auto_scheduling` | ❌ | ❌ | ❌ | ❌ | 🔜 |
| `brand_analysis` | ❌ | ❌ | ❌ | ❌ | 🔜 |
| `competitive_analysis` | ❌ | ❌ | ❌ | ❌ | 🔜 |
| `dashboard` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `integrations` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `create_campaigns` | ❌ | ❌ | ❌ | ❌ | ❌ |
| `campaign_library` | ❌ | ❌ | ❌ | ❌ | ❌ |

**Legend:** ✅ = Enabled, ❌ = Disabled, 🔜 = Coming Soon

### 5.4 Gating Logic Flow

```
Request to access feature
         │
         ▼
┌─────────────────────┐
│ Get user's current  │
│ subscription/plan   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Lookup feature flag │
│ for plan + feature  │
└──────────┬──────────┘
           │
           ▼
    ┌──────┴──────┐
    │ is_enabled? │
    └──────┬──────┘
           │
     ┌─────┴─────┐
     │           │
    YES          NO
     │           │
     ▼           ▼
┌─────────┐ ┌──────────────┐
│ ALLOW   │ │is_coming_soon│
│ ACCESS  │ └──────┬───────┘
└─────────┘        │
             ┌─────┴─────┐
             │           │
            YES          NO
             │           │
             ▼           ▼
      ┌───────────┐ ┌─────────┐
      │ Show blur │ │ BLOCK   │
      │ + "Coming │ │ ACCESS  │
      │ Soon" CTA │ │ (hide)  │
      └───────────┘ └─────────┘
```

---

## 6. API Architecture

### 6.1 API Endpoints

#### Subscription APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/subscriptions/create` | Initiate new subscription |
| GET | `/api/subscriptions/current` | Get user's active subscription |
| POST | `/api/subscriptions/cancel` | Cancel subscription |
| GET | `/api/subscriptions/history` | Get subscription history |

#### Payment APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/create-order` | Create Razorpay order for top-up |
| POST | `/api/payments/verify` | Verify payment signature |
| GET | `/api/payments/history` | Get payment history |

#### Credit APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/credits/balance` | Get current credit balances |
| POST | `/api/credits/deduct` | Deduct credits (internal) |
| GET | `/api/credits/history` | Get credit transaction history |

#### Feature APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/features/access` | Get all feature access for user |
| GET | `/api/features/check/:key` | Check single feature access |

#### Plan APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plans` | Get all available plans |
| GET | `/api/plans/:id` | Get single plan details |
| GET | `/api/credit-packs` | Get available credit packs |

#### Webhook APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/razorpay` | Razorpay webhook receiver |

### 6.2 API Response Contracts

#### Feature Access Response
```json
{
  "features": {
    "image_generation": { "enabled": true, "coming_soon": false },
    "video_generation": { "enabled": false, "coming_soon": false },
    "basic_analytics": { "enabled": false, "coming_soon": true }
  },
  "plan": {
    "id": "plan_starter_monthly",
    "name": "Starter",
    "billing_cycle": "monthly"
  }
}
```

#### Credit Balance Response
```json
{
  "image_credits": {
    "subscription": 15,
    "addon": 10,
    "total": 25
  },
  "video_credits": {
    "subscription": 20,
    "addon": 0,
    "total": 20
  },
  "next_reset_date": "2026-03-01T00:00:00Z"
}
```

---

## 7. Webhook Processing

### 7.1 Supported Webhook Events

| Event | Action |
|-------|--------|
| `payment.captured` | Record payment, add credits if top-up |
| `subscription.activated` | Activate subscription, initialize credits |
| `subscription.charged` | Record renewal payment |
| `subscription.cancelled` | Mark subscription cancelled |
| `subscription.completed` | Handle subscription end |
| `payment.failed` | Log failure, notify if needed |

### 7.2 Webhook Processing Flow

```
Razorpay Webhook
      │
      ▼
┌─────────────────┐
│ Verify Signature│
└────────┬────────┘
         │
    ┌────┴────┐
    │ Valid?  │
    └────┬────┘
         │
    ┌────┴────┐
   NO        YES
    │         │
    ▼         ▼
┌───────┐ ┌─────────────────┐
│ 401   │ │ Check idempotency│
│ Return│ │ (event_id exists)│
└───────┘ └────────┬────────┘
                   │
              ┌────┴────┐
              │ Already │
              │processed│
              └────┬────┘
                   │
              ┌────┴────┐
             YES       NO
              │         │
              ▼         ▼
         ┌───────┐ ┌────────────┐
         │ 200   │ │ Process    │
         │ Return│ │ event      │
         └───────┘ └─────┬──────┘
                         │
                         ▼
                  ┌────────────┐
                  │ Record in  │
                  │ webhook_   │
                  │ events     │
                  └─────┬──────┘
                        │
                        ▼
                   ┌─────────┐
                   │ 200 OK  │
                   └─────────┘
```

### 7.3 Idempotency

- Store `razorpay_event_id` in `webhook_events` table
- Check for duplicate before processing
- Use database transaction for atomic updates
- Return 200 even for duplicates (Razorpay expects this)

---

## 8. Credit Management System

### 8.1 Credit Types

```
┌─────────────────────────────────────────────┐
│              USER CREDITS                    │
├──────────────────────┬──────────────────────┤
│    IMAGE CREDITS     │    VIDEO CREDITS     │
├──────────────────────┼──────────────────────┤
│ ┌──────────────────┐ │ ┌──────────────────┐ │
│ │  Subscription    │ │ │  Subscription    │ │
│ │  (resets monthly)│ │ │  (resets monthly)│ │
│ └──────────────────┘ │ └──────────────────┘ │
│ ┌──────────────────┐ │ ┌──────────────────┐ │
│ │  Addon           │ │ │  Addon           │ │
│ │  (never expires) │ │ │  (never expires) │ │
│ └──────────────────┘ │ └──────────────────┘ │
└──────────────────────┴──────────────────────┘
```

### 8.2 Credit Consumption Priority

```
Generate Image Request
         │
         ▼
┌────────────────────────┐
│ Check: subscription    │
│ image_credits > 0?     │
└───────────┬────────────┘
            │
       ┌────┴────┐
      YES       NO
       │         │
       ▼         ▼
┌────────────┐ ┌────────────────────┐
│ Deduct from│ │ Check: addon       │
│ subscription│ │ image_credits > 0? │
└────────────┘ └──────────┬─────────┘
                          │
                     ┌────┴────┐
                    YES       NO
                     │         │
                     ▼         ▼
              ┌────────────┐ ┌────────────┐
              │ Deduct from│ │ BLOCK      │
              │ addon      │ │ Show modal │
              └────────────┘ └────────────┘
```

### 8.3 Credit History Tracking

Every credit change is logged:

| Operation | Source | Example |
|-----------|--------|---------|
| `add` | `subscription_init` | Initial credits on subscription |
| `add` | `subscription_reset` | Monthly reset |
| `add` | `addon_purchase` | Credit pack purchase |
| `deduct` | `image_generation` | Used for image |
| `deduct` | `video_generation` | Used for video |
| `expire` | `trial_end` | Trial credits expired |

---

## 9. Scheduled Jobs

### 9.1 Monthly Credit Reset Job

**Schedule:** Daily at 00:00 UTC

**Logic:**
```
1. Find all active subscriptions where:
   - status = 'active'
   - next_reset_date <= today

2. For each subscription:
   a. Get plan's credit allocation
   b. Reset subscription credits to plan defaults
   c. Update next_reset_date (+1 month)
   d. Log to credit_history

3. Handle Free Trial separately:
   - If trial_ends_at <= today AND status = 'trialing'
   - Set subscription status = 'expired'
   - Set credits to 0
```

### 9.2 Job Monitoring

- Log job start/end times
- Track number of resets processed
- Alert on failures
- Idempotent (safe to re-run)

---

## 10. Frontend Integration

### 10.1 Required Components

| Component | Purpose |
|-----------|---------|
| `PlanSelector` | Plan selection during signup |
| `PricingPage` | Public pricing display |
| `CheckoutModal` | Razorpay checkout integration |
| `CreditDisplay` | Show current balances |
| `CreditPurchaseModal` | Buy additional credits |
| `FeatureGate` | HOC for feature access control |
| `ComingSoonOverlay` | Blur + upgrade CTA |
| `UpgradeModal` | Plan upgrade prompts |

### 10.2 Feature Gate Component Usage

```
<FeatureGate 
  featureKey="video_generation"
  fallback={<ComingSoonOverlay />}
>
  <VideoGenerator />
</FeatureGate>
```

### 10.3 State Management

Use Zustand stores for:
- `useSubscriptionStore` - Current subscription state
- `useCreditsStore` - Credit balances
- `useFeaturesStore` - Feature access map

### 10.4 Navigation Updates

| Route | Visibility |
|-------|------------|
| `/creative-studio` | Always visible (default landing) |
| `/analytics` | Visible, but gated (Coming Soon) |
| `/dashboard` | Hidden (feature flag) |
| `/integrations` | Hidden (feature flag) |
| `/create-campaign` | Hidden (feature flag) |
| `/campaigns` | Hidden (feature flag) |

---

## 11. Security Considerations

### 11.1 Webhook Security

- Verify Razorpay signature on every webhook
- Use HTTPS only
- Store webhook secret in environment variables
- Implement request timeout

### 11.2 API Security

- All credit operations require authentication
- Server-side credit deduction only (never trust frontend)
- Rate limiting on payment endpoints
- Input validation on all endpoints

### 11.3 Data Protection

- Never store full card details
- PCI compliance via Razorpay (they handle card data)
- Encrypt sensitive data at rest
- Audit log all payment operations

---

## 12. Implementation Phases

### Phase 1: Foundation (Week 1)

**Tasks:**
1. Database schema design and migrations
2. Plan and feature flag seed data
3. Basic DAOs and services
4. Remove old credits system

**Deliverables:**
- All database tables created
- Plans seeded with correct values
- Feature keys and mappings seeded

---

### Phase 2: Razorpay Integration (Week 2)

**Tasks:**
1. Razorpay SDK integration
2. Subscription creation flow
3. Webhook handler implementation
4. Payment verification

**Deliverables:**
- Users can subscribe to plans
- Webhooks processed correctly
- Payments recorded in database

---

### Phase 3: Credit System (Week 3)

**Tasks:**
1. New credit tracking (image + video separate)
2. Credit consumption logic
3. Credit top-up purchases
4. Credit history logging

**Deliverables:**
- Separate image/video credit tracking
- Priority-based consumption working
- Top-up purchases functional

---

### Phase 4: Scheduled Jobs (Week 4)

**Tasks:**
1. Monthly reset job implementation
2. Trial expiration handling
3. Job monitoring and alerts

**Deliverables:**
- Credits reset monthly
- Trials expire correctly
- Jobs run reliably

---

### Phase 5: Frontend Integration (Week 5)

**Tasks:**
1. Plan selection on signup
2. Credit display components
3. Feature gate components
4. Navigation updates
5. Coming Soon overlays

**Deliverables:**
- Complete signup flow with plan selection
- Feature gating working on all routes
- Credit balances displayed correctly

---

### Phase 6: Testing & Polish (Week 6)

**Tasks:**
1. End-to-end testing
2. Webhook reliability testing
3. Edge case handling
4. Error state UI

**Deliverables:**
- All flows tested
- Error handling complete
- Ready for production

---

## Appendix A: Razorpay Configuration Checklist

- [ ] Create Razorpay account
- [ ] Generate API keys (Test + Live)
- [ ] Create subscription plans in Razorpay dashboard
- [ ] Configure webhook URL
- [ ] Enable required webhook events
- [ ] Set up GST invoice settings

## Appendix B: Environment Variables

```
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_ENVIRONMENT=test|live
```

## Appendix C: Migration from Old Credits

1. Backup existing `user_credits` data
2. Map old `credits` to `image_credits_addon` (grandfathered)
3. Set all existing users to require plan selection on next login
4. Drop old `credits` column after migration verified

---

**Document End**
