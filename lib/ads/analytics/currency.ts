/**
 * Ads spend currency helpers — never assume INR.
 */

/** Normalize ISO 4217-ish currency codes from Meta/Google/LinkedIn. */
export function normalizeCurrencyCode(
  raw: string | null | undefined
): string | null {
  if (raw == null) return null;
  const t = String(raw).trim().toUpperCase();
  if (!t) return null;
  // Meta / APIs sometimes return "USD ", "usd", etc.
  if (!/^[A-Z]{3}$/.test(t)) return null;
  return t;
}

export function formatMoneyAmount(
  amount: number | null | undefined,
  currency: string | null | undefined,
  opts?: { locale?: string }
): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  const n = Number(amount);
  const code = normalizeCurrencyCode(currency);
  if (!code) {
    // Unknown currency — show plain number, never invent a symbol
    return n.toLocaleString(opts?.locale || "en-US", {
      maximumFractionDigits: 2,
    });
  }
  try {
    return new Intl.NumberFormat(opts?.locale || "en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${code} ${n.toLocaleString(opts?.locale || "en-US", {
      maximumFractionDigits: 2,
    })}`;
  }
}

export type SpendCurrencyBreakdown = {
  /** Single currency for the aggregate, or null when mixed/unknown */
  currency: string | null;
  mixedCurrency: boolean;
  /** Spend totals keyed by currency code (UNKNOWN when row lacked currency) */
  spendByCurrency: Record<string, number>;
  /**
   * Additive total_spend only when a single known currency (or all UNKNOWN).
   * Null when mixed known currencies — callers must not present a fake grand total.
   */
  totalSpend: number | null;
};

/**
 * Summarize spend across rows that may carry different currencies.
 * Refuses a single total when two different known currencies are present.
 */
export function summarizeSpendByCurrency(
  rows: Array<{ spend?: number | string | null; currency?: string | null }>
): SpendCurrencyBreakdown {
  const spendByCurrency: Record<string, number> = {};
  for (const r of rows) {
    const code = normalizeCurrencyCode(r.currency) || "UNKNOWN";
    const spend = Number(r.spend || 0);
    if (!Number.isFinite(spend)) continue;
    spendByCurrency[code] = (spendByCurrency[code] || 0) + spend;
  }

  const known = Object.keys(spendByCurrency).filter((k) => k !== "UNKNOWN");
  if (known.length > 1) {
    return {
      currency: null,
      mixedCurrency: true,
      spendByCurrency,
      totalSpend: null,
    };
  }
  if (known.length === 1) {
    const currency = known[0];
    // Do not fold UNKNOWN rows into a known currency total
    return {
      currency,
      mixedCurrency: false,
      spendByCurrency,
      totalSpend: spendByCurrency[currency] || 0,
    };
  }

  // Only UNKNOWN or empty
  const total = spendByCurrency.UNKNOWN || 0;
  return {
    currency: null,
    mixedCurrency: false,
    spendByCurrency,
    totalSpend: Object.keys(spendByCurrency).length ? total : 0,
  };
}

/** Prefer account currency when metric rows lack currency (legacy warehouse). */
export function resolveDisplayCurrency(opts: {
  metricCurrencies: string[];
  accountCurrency?: string | null;
}): string | null {
  const fromMetrics = opts.metricCurrencies
    .map(normalizeCurrencyCode)
    .filter((c): c is string => !!c);
  const unique = [...new Set(fromMetrics)];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) return null;
  return normalizeCurrencyCode(opts.accountCurrency);
}
