/**
 * Ads spend currency helpers — INR / non-INR / mixed totals.
 * Run: npx --yes tsx lib/ads/analytics/currency.test.ts
 */
import assert from "assert";
import {
  formatMoneyAmount,
  normalizeCurrencyCode,
  resolveDisplayCurrency,
  summarizeSpendByCurrency,
} from "@/lib/ads/analytics/currency";

// normalize
assert.strictEqual(normalizeCurrencyCode("inr"), "INR");
assert.strictEqual(normalizeCurrencyCode(" USD "), "USD");
assert.strictEqual(normalizeCurrencyCode("usd1"), null);
assert.strictEqual(normalizeCurrencyCode(""), null);
assert.strictEqual(normalizeCurrencyCode(null), null);

// format — never invent INR
{
  const inr = formatMoneyAmount(1000, "INR");
  assert.ok(inr.includes("1") && (inr.includes("₹") || inr.includes("INR")));
  const usd = formatMoneyAmount(42.5, "USD");
  assert.ok(usd.includes("42") && (usd.includes("$") || usd.includes("USD")));
  const unknown = formatMoneyAmount(10, null);
  assert.ok(!unknown.includes("₹"));
  assert.ok(!unknown.includes("INR"));
  assert.strictEqual(formatMoneyAmount(null, "USD"), "—");
}

// single INR account
{
  const s = summarizeSpendByCurrency([
    { spend: 100, currency: "INR" },
    { spend: 50, currency: "inr" },
  ]);
  assert.strictEqual(s.currency, "INR");
  assert.strictEqual(s.mixedCurrency, false);
  assert.strictEqual(s.totalSpend, 150);
}

// single USD account
{
  const s = summarizeSpendByCurrency([{ spend: "12.5", currency: "USD" }]);
  assert.strictEqual(s.currency, "USD");
  assert.strictEqual(s.totalSpend, 12.5);
  assert.strictEqual(s.mixedCurrency, false);
}

// mixed known currencies — refuse grand total
{
  const s = summarizeSpendByCurrency([
    { spend: 100, currency: "INR" },
    { spend: 20, currency: "USD" },
  ]);
  assert.strictEqual(s.currency, null);
  assert.strictEqual(s.mixedCurrency, true);
  assert.strictEqual(s.totalSpend, null);
  assert.strictEqual(s.spendByCurrency.INR, 100);
  assert.strictEqual(s.spendByCurrency.USD, 20);
}

// unknown + known — keep known total, do not invent mix of known codes
{
  const s = summarizeSpendByCurrency([
    { spend: 10, currency: "USD" },
    { spend: 5, currency: null },
  ]);
  assert.strictEqual(s.currency, "USD");
  assert.strictEqual(s.mixedCurrency, false);
  assert.strictEqual(s.totalSpend, 10);
  assert.strictEqual(s.spendByCurrency.UNKNOWN, 5);
}

// resolveDisplayCurrency
assert.strictEqual(
  resolveDisplayCurrency({ metricCurrencies: ["USD"], accountCurrency: "INR" }),
  "USD"
);
assert.strictEqual(
  resolveDisplayCurrency({ metricCurrencies: [], accountCurrency: "INR" }),
  "INR"
);
assert.strictEqual(
  resolveDisplayCurrency({
    metricCurrencies: ["USD", "INR"],
    accountCurrency: "INR",
  }),
  null
);

console.log("ads analytics currency.test: PASS");
