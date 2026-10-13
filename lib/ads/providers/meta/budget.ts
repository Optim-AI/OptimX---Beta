/**
 * Meta Marketing API budget unit helpers (PR W1.4).
 *
 * Planned W2 fields (`daily_budget`, `lifetime_budget` on campaigns/ad sets)
 * are integers in Meta’s **offset-scaled** units for the ad account currency —
 * not necessarily ISO 4217 minor units.
 *
 * Official Meta Marketing API “Currencies” doc defines a static **offset** per
 * code (e.g. USD offset 100 ⇒ API `1` = 0.01 USD; JPY offset 1 ⇒ API `1` = 1 JPY).
 * Ad Account Graph objects expose `currency` but not a per-account offset field
 * in discovery (`me/adaccounts` fields: currency, …) — so we use Meta’s published
 * table, not ISO assumptions and not a guessed default of 100.
 *
 * Evidence (W1.4): archived Marketing API Currencies page
 * `https://developers.facebook.com/docs/marketing-api/currencies`
 * (Wayback `20240601000000`). Live page returned 403 from this environment.
 *
 * Insights / warehouse **spend** remains major units (PR H) — do not use these
 * helpers for Analytics formatting.
 */

import { normalizeCurrencyCode } from "@/lib/ads/analytics/currency";

/**
 * Meta-documented budget/bid offsets only.
 * Values are exactly as published by Meta (1 or 100). No ISO-inferred codes.
 * Three-decimal ISO currencies (KWD, BHD, …) are absent from Meta’s ads table
 * and are intentionally omitted (fail closed).
 */
export type MetaBudgetCurrencyOffset = 1 | 100;

export const META_BUDGET_CURRENCY_OFFSETS: Readonly<
  Record<string, MetaBudgetCurrencyOffset>
> = {
  // offset 100
  AED: 100,
  ARS: 100,
  AUD: 100,
  BDT: 100,
  BOB: 100,
  BRL: 100,
  CAD: 100,
  CHF: 100,
  CNY: 100,
  CZK: 100,
  DKK: 100,
  DZD: 100,
  EGP: 100,
  EUR: 100,
  GBP: 100,
  GTQ: 100,
  HKD: 100,
  HNL: 100,
  ILS: 100,
  INR: 100,
  KES: 100,
  LKR: 100,
  MOP: 100,
  MXN: 100,
  MYR: 100,
  NGN: 100,
  NIO: 100,
  NOK: 100,
  NZD: 100,
  PEN: 100,
  PHP: 100,
  PKR: 100,
  PLN: 100,
  QAR: 100,
  RON: 100,
  RUB: 100,
  SAR: 100,
  SEK: 100,
  SGD: 100,
  THB: 100,
  TRY: 100,
  USD: 100,
  UYU: 100,
  VEF: 100,
  ZAR: 100,
  // offset 1 (Meta zero-subdivision / base-unit budgets)
  CLP: 1,
  COP: 1,
  CRC: 1,
  HUF: 1,
  IDR: 1,
  ISK: 1,
  JPY: 1,
  KRW: 1,
  PYG: 1,
  TWD: 1,
  VND: 1,
};

/**
 * Decimal places implied by Meta offset (offset 1 → 0, offset 100 → 2).
 * Prefer `metaBudgetOffsetForCurrency` when talking to the Marketing API.
 * @deprecated Prefer META_BUDGET_CURRENCY_OFFSETS / metaBudgetOffsetForCurrency
 */
export const META_BUDGET_CURRENCY_EXPONENTS: Readonly<Record<string, 0 | 2>> =
  Object.fromEntries(
    Object.entries(META_BUDGET_CURRENCY_OFFSETS).map(([code, offset]) => [
      code,
      offset === 1 ? 0 : 2,
    ])
  ) as Readonly<Record<string, 0 | 2>>;

export type MetaBudgetCurrencyErrorCode =
  | "missing_currency"
  | "unsupported_currency"
  | "unverified_currency"
  | "invalid_amount"
  | "non_positive"
  | "excess_fractional_precision"
  | "overflow";

export class MetaBudgetCurrencyError extends Error {
  readonly code: MetaBudgetCurrencyErrorCode;
  readonly currency: string | null;

  constructor(
    code: MetaBudgetCurrencyErrorCode,
    message: string,
    currency: string | null = null
  ) {
    super(message);
    this.name = "MetaBudgetCurrencyError";
    this.code = code;
    this.currency = currency;
  }
}

/** Meta Marketing API currency offset for budget/bid integer fields. */
export function metaBudgetOffsetForCurrency(
  currency: string | null | undefined
): MetaBudgetCurrencyOffset {
  const code = normalizeCurrencyCode(currency);
  if (!code) {
    throw new MetaBudgetCurrencyError(
      "missing_currency",
      "Ad account currency is required for budget conversion; never assume INR."
    );
  }
  const offset = META_BUDGET_CURRENCY_OFFSETS[code];
  if (offset == null) {
    throw new MetaBudgetCurrencyError(
      "unverified_currency",
      `Currency ${code} is not in Meta’s documented Marketing API currency-offset table. Budget writes are rejected rather than guessed.`,
      code
    );
  }
  return offset;
}

/**
 * Decimal exponent derived from Meta offset (for string scaling helpers).
 * offset 1 → 0 decimals; offset 100 → 2 decimals.
 */
export function metaBudgetExponentForCurrency(
  currency: string | null | undefined
): 0 | 2 {
  const offset = metaBudgetOffsetForCurrency(currency);
  return offset === 1 ? 0 : 2;
}

function amountToDecimalString(major: number | string): string {
  if (typeof major === "string") {
    return major.trim().replace(/,/g, "");
  }
  if (!Number.isFinite(major)) {
    throw new MetaBudgetCurrencyError(
      "invalid_amount",
      "Budget amount must be a finite number."
    );
  }
  const s = String(major);
  if (/e/i.test(s)) {
    throw new MetaBudgetCurrencyError(
      "invalid_amount",
      "Budget amount is out of safe decimal range (scientific notation)."
    );
  }
  return s;
}

function parseMajorDecimalString(raw: string): {
  negative: boolean;
  whole: string;
  frac: string;
} {
  if (!raw || !/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new MetaBudgetCurrencyError(
      "invalid_amount",
      "Budget amount must be a finite decimal number."
    );
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholeRaw, frac = ""] = unsigned.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  return { negative, whole, frac };
}

/**
 * Convert a user-facing **major-unit** budget (e.g. 10.50 USD, 500 JPY) to the
 * integer Meta Marketing API budget unit (`daily_budget` / `lifetime_budget`).
 *
 * Equivalent to major × Meta offset (USD: ×100, JPY/IDR/HUF/TWD/CLP: ×1).
 * Rejects excess fractional digits; never silently rounds or defaults unknown
 * currencies to offset 100.
 */
export function majorToMetaBudgetMinor(
  major: number | string,
  currency: string | null | undefined
): number {
  const offset = metaBudgetOffsetForCurrency(currency);
  const exp = offset === 1 ? 0 : 2;
  const code = normalizeCurrencyCode(currency)!;
  const asString = amountToDecimalString(major);
  const { negative, whole, frac } = parseMajorDecimalString(asString);

  if (negative || (whole === "0" && /^0*$/.test(frac))) {
    throw new MetaBudgetCurrencyError(
      "non_positive",
      "Budget amount must be greater than zero.",
      code
    );
  }

  const fracSignificant = frac.replace(/0+$/, "");
  if (fracSignificant.length > exp) {
    throw new MetaBudgetCurrencyError(
      "excess_fractional_precision",
      `Budget for ${code} (Meta offset ${offset}) allows at most ${exp} decimal place(s); got "${asString}".`,
      code
    );
  }

  const fracPadded = (frac + "0".repeat(exp)).slice(0, exp);
  const digits = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, "") || "0";

  try {
    const apiUnits = BigInt(digits);
    if (apiUnits <= BigInt(0)) {
      throw new MetaBudgetCurrencyError(
        "non_positive",
        "Budget amount must be greater than zero.",
        code
      );
    }
    if (apiUnits > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new MetaBudgetCurrencyError(
        "overflow",
        "Budget Meta API units exceed safe integer range.",
        code
      );
    }
    return Number(apiUnits);
  } catch (e) {
    if (e instanceof MetaBudgetCurrencyError) throw e;
    throw new MetaBudgetCurrencyError(
      "invalid_amount",
      "Could not convert budget to Meta API units.",
      code
    );
  }
}

/**
 * Convert Meta Marketing API budget integer back to major units.
 * Exact for documented offsets (e.g. 1050 USD → 10.5, 500 JPY → 500).
 */
export function metaBudgetMinorToMajor(
  minor: number | string,
  currency: string | null | undefined
): number {
  const offset = metaBudgetOffsetForCurrency(currency);
  const exp = offset === 1 ? 0 : 2;
  const code = normalizeCurrencyCode(currency)!;
  const n = typeof minor === "string" ? Number(minor) : minor;
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new MetaBudgetCurrencyError(
      "invalid_amount",
      "Meta budget API units must be a finite integer.",
      code
    );
  }
  if (n <= 0) {
    throw new MetaBudgetCurrencyError(
      "non_positive",
      "Budget Meta API units must be greater than zero.",
      code
    );
  }
  if (exp === 0) return n;

  const s = String(Math.trunc(n));
  const pad = s.padStart(exp + 1, "0");
  const whole = pad.slice(0, -exp);
  const frac = pad.slice(-exp);
  return Number(`${whole}.${frac}`);
}
