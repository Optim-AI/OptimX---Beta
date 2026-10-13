/**
 * Meta budget major ↔ API units — offsets from Meta Currencies docs (W1.4).
 * Run: npx --yes tsx lib/ads/providers/meta/budget.test.ts
 *
 * Do not assert an offset merely because ISO 4217 lists a decimal count.
 */
import assert from "assert";
import {
  META_BUDGET_CURRENCY_EXPONENTS,
  META_BUDGET_CURRENCY_OFFSETS,
  MetaBudgetCurrencyError,
  majorToMetaBudgetMinor,
  metaBudgetExponentForCurrency,
  metaBudgetMinorToMajor,
  metaBudgetOffsetForCurrency,
} from "@/lib/ads/providers/meta/budget";

// --- Verified Meta offsets (docs table) ---
assert.strictEqual(metaBudgetOffsetForCurrency("INR"), 100);
assert.strictEqual(metaBudgetOffsetForCurrency("USD"), 100);
assert.strictEqual(metaBudgetOffsetForCurrency("usd"), 100);
assert.strictEqual(metaBudgetOffsetForCurrency("JPY"), 1);
assert.strictEqual(metaBudgetOffsetForCurrency("KRW"), 1);
assert.strictEqual(metaBudgetOffsetForCurrency("IDR"), 1);
assert.strictEqual(metaBudgetOffsetForCurrency("HUF"), 1);
assert.strictEqual(metaBudgetOffsetForCurrency("TWD"), 1);
assert.strictEqual(metaBudgetOffsetForCurrency("CLP"), 1);

assert.strictEqual(metaBudgetExponentForCurrency("INR"), 2);
assert.strictEqual(metaBudgetExponentForCurrency("JPY"), 0);
assert.strictEqual(metaBudgetExponentForCurrency("IDR"), 0);

// Exponents derived from offsets only
assert.strictEqual(META_BUDGET_CURRENCY_EXPONENTS.IDR, 0);
assert.strictEqual(META_BUDGET_CURRENCY_EXPONENTS.HUF, 0);
assert.strictEqual(META_BUDGET_CURRENCY_EXPONENTS.TWD, 0);
assert.strictEqual(META_BUDGET_CURRENCY_OFFSETS.IDR, 1);
assert.strictEqual(META_BUDGET_CURRENCY_OFFSETS.USD, 100);

// Missing currency
{
  let threw = false;
  try {
    metaBudgetOffsetForCurrency(null);
  } catch (e) {
    threw = true;
    assert.ok(e instanceof MetaBudgetCurrencyError);
    assert.strictEqual(e.code, "missing_currency");
  }
  assert.ok(threw);
}

// Unknown / unverified — including ISO three-decimal codes NOT in Meta ads table
for (const code of ["XXX", "KWD", "BHD", "JOD", "OMR", "TND", "LYD", "IQD", "BIF"]) {
  let threw = false;
  try {
    metaBudgetOffsetForCurrency(code);
  } catch (e) {
    threw = true;
    assert.ok(e instanceof MetaBudgetCurrencyError);
    assert.strictEqual(
      (e as MetaBudgetCurrencyError).code,
      "unverified_currency",
      code
    );
  }
  assert.ok(threw, `expected reject ${code}`);
}

// Round-trip INR / USD (offset 100)
{
  assert.strictEqual(majorToMetaBudgetMinor("10.50", "INR"), 1050);
  assert.strictEqual(metaBudgetMinorToMajor(1050, "INR"), 10.5);
  assert.strictEqual(majorToMetaBudgetMinor(10.5, "INR"), 1050);
  assert.strictEqual(majorToMetaBudgetMinor("99.99", "USD"), 9999);
  assert.strictEqual(metaBudgetMinorToMajor(9999, "USD"), 99.99);
}

// Zero-decimal / Meta offset-1: JPY, KRW, IDR, HUF, TWD, CLP
for (const code of ["JPY", "KRW", "IDR", "HUF", "TWD", "CLP"] as const) {
  assert.strictEqual(majorToMetaBudgetMinor(500, code), 500, code);
  assert.strictEqual(metaBudgetMinorToMajor(500, code), 500, code);
  assert.strictEqual(majorToMetaBudgetMinor("1000", code), 1000, code);
  let threw = false;
  try {
    majorToMetaBudgetMinor("10.5", code);
  } catch (e) {
    threw = true;
    assert.strictEqual(
      (e as MetaBudgetCurrencyError).code,
      "excess_fractional_precision"
    );
  }
  assert.ok(threw, `fractional rejected for ${code}`);
}

// Trailing zeros within offset-100 precision OK
assert.strictEqual(majorToMetaBudgetMinor("10.5000", "USD"), 1050);

// Excess fractional precision — no silent round
{
  let threw = false;
  try {
    majorToMetaBudgetMinor("10.001", "USD");
  } catch (e) {
    threw = true;
    assert.strictEqual(
      (e as MetaBudgetCurrencyError).code,
      "excess_fractional_precision"
    );
  }
  assert.ok(threw);
}

// Three-decimal major amounts for unverified KWD fail closed (not converted)
{
  let threw = false;
  try {
    majorToMetaBudgetMinor("1.234", "KWD");
  } catch (e) {
    threw = true;
    assert.strictEqual(
      (e as MetaBudgetCurrencyError).code,
      "unverified_currency"
    );
  }
  assert.ok(threw);
}

// Non-positive / invalid
for (const bad of [0, -1, "0", "-5", NaN, Infinity, "abc", ""]) {
  let threw = false;
  try {
    majorToMetaBudgetMinor(bad as any, "USD");
  } catch {
    threw = true;
  }
  assert.ok(threw, `expected reject for ${String(bad)}`);
}

// Never assume INR
{
  let threw = false;
  try {
    majorToMetaBudgetMinor(100, undefined);
  } catch (e) {
    threw = true;
    assert.strictEqual((e as MetaBudgetCurrencyError).code, "missing_currency");
  }
  assert.ok(threw);
}

// Overflow
{
  let threw = false;
  try {
    majorToMetaBudgetMinor(String(Number.MAX_SAFE_INTEGER) + "0", "JPY");
  } catch (e) {
    threw = true;
    assert.strictEqual((e as MetaBudgetCurrencyError).code, "overflow");
  }
  assert.ok(threw);
}

console.log("budget.test.ts: ok");
