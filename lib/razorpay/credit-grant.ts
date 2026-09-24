// lib/razorpay/credit-grant.ts
// Single place that grants PAYG credits after a payment is atomically captured.
// Called by the webhook OR by verify when it wins the capture race — never both.

import type { Payment } from '@/database/models/Payments.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';
import { VoucherDAO } from '@/database/models/Voucher.dao';

/**
 * Grant addon credits for an already-captured top-up payment.
 * Safe to call only after PaymentsDAO.captureIfCreated returned the row
 * (i.e. this process won the created → captured race).
 */
export async function grantCreditsForCapturedPayment(payment: Payment): Promise<void> {
  if (payment.paymentType !== 'image_topup' && payment.paymentType !== 'video_topup') {
    return;
  }

  const metadata = (payment.metadata || {}) as {
    creditType?: string;
    credits?: number;
    voucherId?: string;
    voucherCredits?: number;
  };

  const credits = Number(metadata.credits);
  if (!Number.isInteger(credits) || credits < 1) {
    console.error('[credit-grant] Invalid credits in payment metadata', payment.id);
    return;
  }

  if (metadata.creditType === 'image') {
    await CreditsDAO.addImageCreditsAddon(payment.userId, credits, 'addon_purchase', {
      paymentId: payment.id,
      razorpayPaymentId: payment.razorpayPaymentId,
    });
  } else if (metadata.creditType === 'video') {
    await CreditsDAO.addVideoCreditsAddon(payment.userId, credits, 'addon_purchase', {
      paymentId: payment.id,
      razorpayPaymentId: payment.razorpayPaymentId,
      unit: 'video_credits',
    });
  } else {
    console.error('[credit-grant] Unknown creditType', metadata.creditType, payment.id);
    return;
  }

  // Voucher bonus — only when this process captured the payment
  if (metadata.voucherId && metadata.voucherCredits && metadata.voucherCredits > 0) {
    const redeemed = await VoucherDAO.markRedeemed(metadata.voucherId, payment.id);
    if (redeemed) {
      if (metadata.creditType === 'image') {
        await CreditsDAO.addImageCreditsAddon(
          payment.userId,
          metadata.voucherCredits,
          'voucher_redeem',
          { paymentId: payment.id, voucherId: metadata.voucherId }
        );
      } else if (metadata.creditType === 'video') {
        await CreditsDAO.addVideoCreditsAddon(
          payment.userId,
          metadata.voucherCredits,
          'voucher_redeem',
          { paymentId: payment.id, voucherId: metadata.voucherId, unit: 'video_credits' }
        );
      }
    }
  }
}
