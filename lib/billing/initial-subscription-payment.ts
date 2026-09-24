/**
 * Initial subscription entitlement from Razorpay addon invoice payments.
 *
 * SkalX creates subscriptions with:
 * - deferred start_at (next cycle)
 * - first-month charge as Razorpay `addons[]` invoice
 *
 * That payment arrives as payment.captured with payment.subscription_id = null.
 * Resolve via invoice_id → invoice.subscription_id + addon line items.
 *
 * Recurring renewals remain subscription.charged → provisionSubscriptionCycleForCharge.
 */

import { razorpay } from '@/lib/razorpay/client';
import { PaymentsDAO } from '@/database/models/Payments.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { PlansDAO } from '@/database/models/Plans.dao';
import { isCanonicalSubscriptionPlanId } from '@/lib/billing/canonical-plans';
import { subscriptionTotalsInr } from '@/lib/billing/marketing-plans';
import { provisionSubscriptionCycleForCharge } from '@/lib/billing/subscription-entitlement';

export type CapturedPaymentEntity = {
  id?: string;
  status?: string;
  captured?: boolean | number | string;
  amount?: number;
  currency?: string;
  order_id?: string | null;
  invoice_id?: string | null;
  subscription_id?: string | null;
};

export type RazorpayInvoiceLike = {
  id?: string;
  status?: string;
  subscription_id?: string | null;
  payment_id?: string | null;
  amount?: number;
  amount_paid?: number;
  currency?: string;
  line_items?: Array<{
    name?: string;
    amount?: number;
    type?: string;
  }>;
};

export type FetchInvoiceFn = (invoiceId: string) => Promise<RazorpayInvoiceLike>;

const INITIAL_ELIGIBLE_STATUSES = new Set(['pending', 'past_due']);

export function isPaymentCaptured(payment: CapturedPaymentEntity): boolean {
  if (!payment?.id) return false;
  if (payment.status === 'captured') return true;
  return payment.captured === true || payment.captured === 1 || payment.captured === '1';
}

export function isFirstMonthSubscriptionAddonInvoice(
  invoice: RazorpayInvoiceLike
): boolean {
  if (!invoice?.id) return false;
  if (invoice.status && invoice.status !== 'paid') return false;
  if (typeof invoice.subscription_id !== 'string' || !invoice.subscription_id.trim()) {
    return false;
  }

  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  if (items.length === 0) return false;

  const addonItems = items.filter((li) => String(li?.type || '').toLowerCase() === 'addon');
  if (addonItems.length === 0) return false;

  // Our create path names the addon "{Plan} — first month (incl. GST)"
  return addonItems.some((li) => /first\s*month/i.test(String(li?.name || '')));
}

export async function defaultFetchInvoice(invoiceId: string): Promise<RazorpayInvoiceLike> {
  const invoice = await razorpay.invoices.fetch(invoiceId);
  return invoice as RazorpayInvoiceLike;
}

export type InitialSubscriptionProvisionResult =
  | { handled: false; reason: string }
  | {
      handled: true;
      provisioned: boolean;
      created: boolean;
      subscriptionId: string;
      razorpayPaymentId: string;
      razorpaySubscriptionId: string;
      cycleId: string;
    };

/**
 * Attempt to treat a captured payment as the first-month subscription addon.
 * Returns handled:false when evidence is insufficient or ambiguous (caller must not grant).
 */
export async function tryProvisionInitialSubscriptionFromCapturedPayment(
  paymentEntity: CapturedPaymentEntity,
  deps?: { fetchInvoice?: FetchInvoiceFn }
): Promise<InitialSubscriptionProvisionResult> {
  if (!isPaymentCaptured(paymentEntity)) {
    return { handled: false, reason: 'payment_not_captured' };
  }

  const razorpayPaymentId =
    typeof paymentEntity.id === 'string' ? paymentEntity.id.trim() : '';
  if (!razorpayPaymentId) {
    return { handled: false, reason: 'missing_payment_id' };
  }

  const currency = String(paymentEntity.currency || '').toUpperCase();
  if (currency && currency !== 'INR') {
    return { handled: false, reason: 'currency_not_inr' };
  }

  const invoiceId =
    typeof paymentEntity.invoice_id === 'string' ? paymentEntity.invoice_id.trim() : '';
  if (!invoiceId) {
    return { handled: false, reason: 'missing_invoice_id' };
  }

  const fetchInvoice = deps?.fetchInvoice ?? defaultFetchInvoice;
  let invoice: RazorpayInvoiceLike;
  try {
    invoice = await fetchInvoice(invoiceId);
  } catch (err) {
    console.error(
      '[initial-sub] failed to fetch invoice',
      invoiceId,
      err instanceof Error ? err.message : err
    );
    return { handled: false, reason: 'invoice_fetch_failed' };
  }

  if (!isFirstMonthSubscriptionAddonInvoice(invoice)) {
    return { handled: false, reason: 'not_first_month_addon_invoice' };
  }

  if (invoice.payment_id && invoice.payment_id !== razorpayPaymentId) {
    return { handled: false, reason: 'invoice_payment_mismatch' };
  }

  const razorpaySubscriptionId = String(invoice.subscription_id).trim();
  const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
  if (!subscription) {
    return { handled: false, reason: 'local_subscription_not_found' };
  }

  // pending/past_due: first entitlement. active: allow idempotent re-delivery only.
  if (
    subscription.status === 'cancelled' ||
    subscription.status === 'expired'
  ) {
    return { handled: false, reason: `subscription_status_${subscription.status}` };
  }
  if (
    !INITIAL_ELIGIBLE_STATUSES.has(subscription.status) &&
    subscription.status !== 'active'
  ) {
    return { handled: false, reason: `subscription_status_${subscription.status}` };
  }

  if (!isCanonicalSubscriptionPlanId(subscription.planId)) {
    return { handled: false, reason: 'plan_not_canonical' };
  }

  const plan = await PlansDAO.getById(subscription.planId);
  if (!plan || !plan.isActive) {
    return { handled: false, reason: 'plan_missing_or_inactive' };
  }

  const expectedPaise = subscriptionTotalsInr(plan.priceInr).totalInr * 100;
  const paidPaise = Number(paymentEntity.amount);
  if (!Number.isFinite(paidPaise) || paidPaise !== expectedPaise) {
    return {
      handled: false,
      reason: `amount_mismatch_expected_${expectedPaise}_got_${paidPaise}`,
    };
  }

  // Prefer invoice amount when present
  if (typeof invoice.amount === 'number' && invoice.amount !== expectedPaise) {
    return {
      handled: false,
      reason: `invoice_amount_mismatch_expected_${expectedPaise}_got_${invoice.amount}`,
    };
  }

  await PaymentsDAO.createIfAbsentByRazorpayPaymentId({
    userId: subscription.userId,
    subscriptionId: subscription.id,
    razorpayPaymentId,
    razorpayOrderId:
      typeof paymentEntity.order_id === 'string' ? paymentEntity.order_id : null,
    amount: expectedPaise / 100,
    currency: 'INR',
    status: 'captured',
    paymentType: 'subscription',
    metadata: {
      source: 'initial_subscription_addon',
      razorpayInvoiceId: invoiceId,
      razorpaySubscriptionId,
      event: 'payment.captured',
    },
  });

  const periodStart = subscription.currentPeriodStart
    ? new Date(subscription.currentPeriodStart)
    : new Date();
  const periodEnd = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : undefined;

  const result = await provisionSubscriptionCycleForCharge({
    subscriptionId: subscription.id,
    userId: subscription.userId,
    planId: subscription.planId,
    razorpayPaymentId,
    periodStart,
    periodEnd,
    metadata: {
      razorpaySubscriptionId,
      razorpayInvoiceId: invoiceId,
      event: 'payment.captured',
      source: 'initial_subscription_addon',
    },
  });

  return {
    handled: true,
    provisioned: result.creditsGranted,
    created: result.created,
    subscriptionId: subscription.id,
    razorpayPaymentId,
    razorpaySubscriptionId,
    cycleId: result.cycle.id,
  };
}
