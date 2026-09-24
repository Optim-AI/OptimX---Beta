/**
 * Pure subscription-first credit split (shared by DAO + tests).
 * Drains subscription balance before addon. No I/O.
 */

export type CreditSplitResult = {
  newSubscription: number;
  newAddon: number;
  fromSubscription: number;
  fromAddon: number;
};

export function splitCreditDeduction(
  subscription: number,
  addon: number,
  amount: number
): CreditSplitResult | null {
  const sub = Number(subscription) || 0;
  const add = Number(addon) || 0;
  const need = Number(amount) || 0;
  if (!Number.isInteger(need) || need < 1) return null;
  if (sub + add < need) return null;

  let remaining = need;
  let fromSubscription = 0;
  let fromAddon = 0;
  let newSubscription = sub;
  let newAddon = add;

  if (newSubscription >= remaining) {
    fromSubscription = remaining;
    newSubscription -= remaining;
  } else {
    fromSubscription = newSubscription;
    remaining -= newSubscription;
    newSubscription = 0;
    fromAddon = remaining;
    newAddon -= remaining;
  }

  return { newSubscription, newAddon, fromSubscription, fromAddon };
}
