/**
 * Customer-facing messages for subscription-first / addon fallback credit usage.
 * Pure helpers — no DB, no Razorpay, no generation.
 */

export type CreditUsageSplit = {
  fromSubscription: number;
  fromAddon: number;
  requiredCredits: number;
  creditType: 'image' | 'video';
};

export function formatPreGenerationCreditNotice(split: CreditUsageSplit): string | null {
  if (split.fromAddon <= 0) return null;
  const unit =
    split.creditType === 'video' ? 'Add-on Video Credits' : 'Add-on Image Credits';
  if (split.fromSubscription > 0) {
    return `Your subscription credits cover part of this. The rest will use ${split.fromAddon} ${unit}.`;
  }
  return `Your subscription credits are used up. This generation will use ${split.fromAddon} ${unit}.`;
}

export function formatPostGenerationCreditSummary(split: CreditUsageSplit): string {
  const unit =
    split.creditType === 'video' ? 'Video Credits' : 'Image Credits';
  const addonUnit =
    split.creditType === 'video' ? 'Add-on Video Credits' : 'Add-on Image Credits';

  if (split.fromAddon > 0 && split.fromSubscription > 0) {
    return `${split.requiredCredits} ${unit} used (${split.fromSubscription} subscription + ${split.fromAddon} add-on).`;
  }
  if (split.fromAddon > 0) {
    return `${split.fromAddon} ${addonUnit} used.`;
  }
  return `${split.requiredCredits} ${unit} used.`;
}
