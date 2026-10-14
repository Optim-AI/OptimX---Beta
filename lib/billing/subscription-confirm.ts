/**
 * Server-side confirmation of the first subscription payment after Checkout.
 * Browser checkout success is never trusted as proof of capture or entitlement.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { razorpay } from '@/lib/razorpay/client';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import {
  isPaymentCaptured,
  tryProvisionInitialSubscriptionFromCapturedPayment,
  type CapturedPaymentEntity,
  type FetchInvoiceFn,
} from '@/lib/billing/initial-subscription-payment';
import { classifyInitialProvisionReason } from '@/lib/billing/subscription-payment-outcome';

export type ConfirmSubscriptionPaymentParams = {
  userId: string;
  /** Local subscriptions.id from /subscriptions/create */
  subscriptionId: string;
  razorpayPaymentId: string;
  /** Razorpay subscription id returned at create / checkout */
  razorpaySubscriptionId: string;
  /** Checkout signature: HMAC(payment_id|subscription_id) */
  razorpaySignature?: string;
};

export type ConfirmSubscriptionPaymentResult =
  | {
      status: 'provisioned';
      alreadyProvisioned: boolean;
      subscriptionId: string;
      cycleId: string;
      razorpayPaymentId: string;
    }
  | {
      status: 'pending';
      reason: string;
      message: string;
    }
  | {
      status: 'rejected';
      reason: string;
      message: string;
      permanent: boolean;
    };

export type FetchPaymentFn = (paymentId: string) => Promise<CapturedPaymentEntity>;

function verifyCheckoutSignature(
  razorpayPaymentId: string,
  razorpaySubscriptionId: string,
  razorpaySignature: string
): boolean {
  const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!secret || !razorpaySignature) return false;
  const expected = createHmac('sha256', secret)
    .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
    .digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(razorpaySignature).trim(), 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function defaultFetchPayment(
  paymentId: string
): Promise<CapturedPaymentEntity> {
  const payment = await razorpay.payments.fetch(paymentId);
  return payment as CapturedPaymentEntity;
}

/**
 * Confirm and provision the first-month subscription payment for the authenticated user.
 */
export async function confirmSubscriptionPayment(
  params: ConfirmSubscriptionPaymentParams,
  deps?: {
    fetchPayment?: FetchPaymentFn;
    fetchInvoice?: FetchInvoiceFn;
    /** When false, skip signature check (tests only). Production always verifies when signature present. */
    requireSignature?: boolean;
  }
): Promise<ConfirmSubscriptionPaymentResult> {
  const userId = params.userId?.trim();
  const subscriptionId = params.subscriptionId?.trim();
  const razorpayPaymentId = params.razorpayPaymentId?.trim();
  const razorpaySubscriptionId = params.razorpaySubscriptionId?.trim();

  if (!userId || !subscriptionId || !razorpayPaymentId || !razorpaySubscriptionId) {
    return {
      status: 'rejected',
      reason: 'missing_params',
      message: 'Subscription confirmation requires payment and subscription identifiers.',
      permanent: true,
    };
  }

  // Razorpay payment ids look like pay_29QQoUBi66xm2f (prefix + alphanumeric).
  if (!/^pay_[A-Za-z0-9]+$/.test(razorpayPaymentId)) {
    return {
      status: 'rejected',
      reason: 'invalid_payment_id',
      message: 'Invalid payment identifier.',
      permanent: true,
    };
  }

  const requireSignature = deps?.requireSignature !== false;
  if (requireSignature) {
    if (!params.razorpaySignature?.trim()) {
      return {
        status: 'rejected',
        reason: 'missing_signature',
        message: 'Payment signature is required.',
        permanent: true,
      };
    }
    if (
      !verifyCheckoutSignature(
        razorpayPaymentId,
        razorpaySubscriptionId,
        params.razorpaySignature
      )
    ) {
      return {
        status: 'rejected',
        reason: 'invalid_signature',
        message: 'Payment signature verification failed.',
        permanent: true,
      };
    }
  }

  const subscription = await SubscriptionsDAO.getById(subscriptionId);
  if (!subscription || subscription.userId !== userId) {
    return {
      status: 'rejected',
      reason: 'subscription_not_found',
      message: 'Subscription not found for this account.',
      permanent: true,
    };
  }

  if (
    !subscription.razorpaySubscriptionId ||
    subscription.razorpaySubscriptionId !== razorpaySubscriptionId
  ) {
    return {
      status: 'rejected',
      reason: 'razorpay_subscription_mismatch',
      message: 'Payment does not belong to this subscription.',
      permanent: true,
    };
  }

  if (subscription.status === 'cancelled' || subscription.status === 'expired') {
    return {
      status: 'rejected',
      reason: `subscription_status_${subscription.status}`,
      message: 'This subscription is no longer eligible for credit provisioning.',
      permanent: true,
    };
  }

  let paymentEntity: CapturedPaymentEntity;
  try {
    const fetchPayment = deps?.fetchPayment ?? defaultFetchPayment;
    paymentEntity = await fetchPayment(razorpayPaymentId);
  } catch (err) {
    console.error(
      '[confirm-sub] payment fetch failed',
      err instanceof Error ? err.message : err
    );
    return {
      status: 'pending',
      reason: 'payment_fetch_failed',
      message:
        'Payment details are not available yet. Credits will appear after capture completes.',
    };
  }

  if (!paymentEntity?.id || String(paymentEntity.id).trim() !== razorpayPaymentId) {
    return {
      status: 'rejected',
      reason: 'payment_id_mismatch',
      message: 'Payment identifier mismatch.',
      permanent: true,
    };
  }

  if (!isPaymentCaptured(paymentEntity)) {
    return {
      status: 'pending',
      reason: 'payment_not_captured',
      message:
        'Payment is still processing. Your plan credits will appear once capture completes.',
    };
  }

  const result = await tryProvisionInitialSubscriptionFromCapturedPayment(paymentEntity, {
    fetchInvoice: deps?.fetchInvoice,
    expected: {
      userId,
      subscriptionId,
      razorpaySubscriptionId,
    },
  });

  if (result.handled) {
    return {
      status: 'provisioned',
      alreadyProvisioned: !result.created && !result.provisioned,
      subscriptionId: result.subscriptionId,
      cycleId: result.cycleId,
      razorpayPaymentId: result.razorpayPaymentId,
    };
  }

  const kind = classifyInitialProvisionReason(result.reason);
  if (kind === 'pending' || kind === 'retryable') {
    return {
      status: 'pending',
      reason: result.reason,
      message:
        kind === 'pending'
          ? 'Payment is still processing. Your plan credits will appear once capture completes.'
          : 'Payment was received; entitlements are still settling. Please wait a moment.',
    };
  }

  return {
    status: 'rejected',
    reason: result.reason,
    message: 'Payment could not be matched to this subscription entitlement.',
    permanent: true,
  };
}
