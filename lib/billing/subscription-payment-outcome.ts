/**
 * Classification of initial-subscription / webhook payment outcomes.
 * Shared by confirm-payment and WebhookService so retries and ops stay aligned.
 */

export type PaymentOutcomeKind =
  | 'success'
  | 'pending'
  | 'ignored'
  | 'retryable'
  | 'permanent';

/** Reasons returned by tryProvisionInitialSubscriptionFromCapturedPayment (handled:false). */
export function classifyInitialProvisionReason(reason: string): PaymentOutcomeKind {
  const r = String(reason || '').trim();

  if (
    r === 'payment_not_captured' ||
    r === 'missing_invoice_id' ||
    r === 'invoice_fetch_failed'
  ) {
    // Capture/invoice may still be settling; safe to retry.
    return r === 'payment_not_captured' ? 'pending' : 'retryable';
  }

  if (r === 'local_subscription_not_found') {
    // Local row may lag checkout create by milliseconds; treat as retryable briefly.
    return 'retryable';
  }

  // Amount/currency/status/plan mismatches and non-addon invoices are permanent.
  return 'permanent';
}

export function isRetryableWebhookOutcome(kind: PaymentOutcomeKind): boolean {
  return kind === 'retryable' || kind === 'pending';
}
