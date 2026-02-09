# Plan Upgrade & Downgrade - Best Practices Documentation

## Overview

This document outlines the implementation and best practices for handling subscription plan upgrades and downgrades in OptimX.

## Architecture

### Components

1. **PlanChangeService** (`lib/razorpay/plan-change.service.ts`)
   - Handles all plan change logic
   - Calculates prorated amounts
   - Manages credit adjustments
   - Coordinates with Razorpay API

2. **API Endpoint** (`/api/billing/subscriptions/change-plan`)
   - RESTful endpoint for plan changes
   - Validates user authorization
   - Returns prorated amounts and effective dates

3. **Pricing Page** (`pages/pricing.tsx`)
   - Shows current plan highlighted
   - Displays upgrade/downgrade options
   - Handles plan change UI flow

## Best Practices Implemented

### 1. Immediate Plan Changes ✅

**Why:** Better user experience - users see changes immediately rather than waiting for next billing cycle.

**Implementation:**
- Plan changes take effect immediately
- Features are updated instantly
- Credits are adjusted right away

**Trade-off:** Requires prorating calculations, but provides superior UX.

---

### 2. Prorated Billing ✅

**Why:** Fair billing - users only pay for what they use.

**Formula:**
```
Remaining Days = (Period End - Now) / (Period End - Period Start)
Prorated Amount = (New Price - Old Price) × Remaining Ratio
```

**Implementation:**
- Upgrades: Charge prorated difference immediately
- Downgrades: Credit prorated difference (applied to next billing)

**Example:**
- User on ₹999/month plan, 15 days remaining
- Upgrades to ₹1499/month plan
- Prorated charge: (1499 - 999) × (15/30) = ₹250

---

### 3. Credit Adjustment Strategy ✅

**Upgrades:**
- Immediately grant additional credits proportionally
- Formula: `Additional Credits = (New Plan Credits - Old Plan Credits) × Remaining Days Ratio`
- Credits added as "addon" credits (never expire)

**Downgrades:**
- Keep current credits until next reset
- User-friendly approach - no immediate credit reduction
- Next monthly reset will use new plan limits

**Rationale:**
- Prevents user frustration from losing credits mid-cycle
- Aligns with industry best practices (Stripe, Paddle)

---

### 4. Feature Access ✅

**Implementation:**
- Features updated immediately via `FeatureService`
- No service interruption
- Graceful feature degradation on downgrade

**Example:**
- User downgrades from Growth Pro (has Analytics) to Basic (no Analytics)
- Analytics feature immediately hidden
- Existing analytics data preserved (read-only)

---

### 5. Seamless Transition ✅

**Implementation:**
- No service interruption during plan changes
- Background processing
- Clear user feedback

**User Flow:**
1. User clicks "Upgrade" or "Downgrade"
2. Confirmation dialog shows prorated amount
3. Processing indicator
4. Success message with new plan details
5. Immediate feature/credit updates

---

### 6. Audit Trail ✅

**Implementation:**
- All plan changes logged in `payments` table
- Metadata includes:
  - Old plan name
  - New plan name
  - Prorated amount
  - Change type (upgrade/downgrade)
  - Timestamp

**Use Cases:**
- Customer support inquiries
- Financial reconciliation
- Analytics and reporting

---

## Constraints & Limitations

### 1. Billing Cycle Changes

**Constraint:** Cannot change billing cycle (monthly ↔ quarterly) directly.

**Reason:** Razorpay subscriptions are tied to specific billing cycles.

**Workaround:**
- User must cancel current subscription
- Subscribe to new plan with desired billing cycle
- Clear messaging in UI explains this limitation

### 2. Trial to Paid Upgrade

**Constraint:** Cannot use plan change API for trial → paid.

**Reason:** Trials don't have Razorpay subscriptions.

**Workaround:**
- Use `createSubscription` endpoint
- Handles trial expiration separately

### 3. Same Plan Selection

**Prevention:** UI disables button, API returns error.

**Reason:** Prevents unnecessary API calls and confusion.

---

## Razorpay Integration

### Current Approach

Since Razorpay doesn't support direct plan changes, we:

1. **Cancel** current subscription immediately
2. **Create** new subscription with new plan
3. **Handle** prorated payments separately

### Alternative Approaches Considered

1. **Wait for Period End** ❌
   - Poor UX - users wait for changes
   - Not implemented

2. **Manual Prorating** ✅ (Current)
   - Calculate prorated amount
   - Create one-time payment for difference
   - Better UX, more control

3. **Razorpay Pause/Resume** ❌
   - Not available in Razorpay API
   - Would require custom implementation

---

## Credit Management

### Upgrade Flow

```
User upgrades from Basic (15 images) → Starter (20 images)
Current period: 15 days remaining
Credit difference: 20 - 15 = 5 images
Prorated credits: 5 × (15/30) = 2.5 → 3 images
Action: Add 3 image credits as addon
```

### Downgrade Flow

```
User downgrades from Starter (20 images) → Basic (15 images)
Current credits: 18 images (3 remaining from subscription)
Action: Keep 18 images until next reset
Next reset: Reset to 15 images (new plan limit)
```

---

## Error Handling

### Common Errors

1. **"Already on this plan"**
   - User tries to change to current plan
   - UI prevents this, API validates

2. **"Cannot change billing cycle"**
   - User tries monthly ↔ quarterly
   - Clear error message with instructions

3. **"Subscription not found"**
   - Invalid subscription ID
   - Authorization check fails

4. **"Plan not found"**
   - Invalid plan ID
   - Plan may have been deactivated

### Recovery

- All errors logged with context
- User-friendly error messages
- Support contact information provided

---

## Testing

### Test Scenarios

1. ✅ Upgrade: Basic → Starter (monthly)
2. ✅ Downgrade: Growth Pro → Starter (monthly)
3. ✅ Same billing cycle validation
4. ✅ Prorated amount calculation
5. ✅ Credit adjustment on upgrade
6. ✅ Credit preservation on downgrade
7. ✅ Feature access updates
8. ✅ Error handling (invalid plan, unauthorized)

### Test Endpoints

- Development: `/api/testing/create-test-subscription`
- Production: `/api/billing/subscriptions/change-plan`

---

## UI/UX Guidelines

### Visual Indicators

1. **Current Plan:**
   - Green border and badge
   - "Current Plan" label
   - Disabled button

2. **Upgrade Option:**
   - Green gradient button
   - "Upgrade" label
   - Shows prorated charge in tooltip

3. **Downgrade Option:**
   - Gray outline button
   - "Downgrade" label
   - Shows credit amount in tooltip

### User Feedback

- Loading states during processing
- Success messages with new plan details
- Error messages with actionable steps
- Confirmation dialogs for significant changes

---

## Security Considerations

1. **Authorization:**
   - User can only change their own subscription
   - Server-side validation

2. **Validation:**
   - Plan IDs validated against database
   - Subscription ownership verified

3. **Audit:**
   - All changes logged
   - Payment records created for upgrades

---

## Future Enhancements

1. **Scheduled Changes:**
   - Allow users to schedule plan changes
   - Change takes effect at period end

2. **Bulk Operations:**
   - Admin interface for bulk plan changes
   - Useful for promotions

3. **Plan Comparison:**
   - Side-by-side comparison view
   - Highlight differences

4. **Change History:**
   - User-facing change history
   - Show all plan changes over time

---

## References

- [Razorpay Subscription API](https://razorpay.com/docs/api/subscriptions/)
- [Stripe Upgrade/Downgrade Guide](https://stripe.com/docs/billing/subscriptions/upgrading-downgrading)
- [Paddle Plan Changes](https://developer.paddle.com/concepts/pricing/plan-changes)

---

## Changelog

- **2026-02-03:** Initial implementation
  - Plan change service
  - Prorated billing
  - Credit adjustments
  - UI updates
