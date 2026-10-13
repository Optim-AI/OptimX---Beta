/**
 * Selected ad-account isolation for warehouse metrics.
 * Never combine multiple accounts into one Analytics total.
 */

export type SelectedAdAccountRef = {
  /** Internal UUID (`ad_accounts.id`) stamped on metric rows */
  id: string;
  /** Meta/Google external account id (no act_ prefix for Meta) */
  accountId?: string | null;
  currency?: string | null;
  name?: string | null;
} | null | undefined;

export type WarehouseAccountScope =
  | {
      ok: true;
      adAccountId: string;
      accountExternalId: string | null;
      currency: string | null;
      name: string | null;
    }
  | {
      ok: false;
      reason: "no_selected_account";
      message: string;
    };

/**
 * Resolve the account that Analytics must query.
 * Without an explicit selection, metrics are unavailable — do not guess.
 */
export function resolveWarehouseAccountScope(
  selected: SelectedAdAccountRef
): WarehouseAccountScope {
  const id = selected?.id ? String(selected.id).trim() : "";
  if (!id) {
    return {
      ok: false,
      reason: "no_selected_account",
      message:
        "Select an advertising account to view metrics. Totals are never combined across accounts.",
    };
  }
  return {
    ok: true,
    adAccountId: id,
    accountExternalId: selected?.accountId
      ? String(selected.accountId).replace(/^act_/, "")
      : null,
    currency: selected?.currency ?? null,
    name: selected?.name ?? null,
  };
}

/**
 * Keep only rows stamped with the selected ad_accounts.id.
 * Rows with null/missing adAccountId are untreated legacy data — excluded.
 */
export function filterRowsForSelectedAdAccount<
  T extends { adAccountId?: string | null },
>(rows: T[], adAccountId: string): T[] {
  const id = String(adAccountId);
  return rows.filter((r) => r.adAccountId != null && String(r.adAccountId) === id);
}

/**
 * Unique grain for daily metrics (post-isolation).
 * Must include adAccountId so two accounts never share one upsert row.
 */
export function metricDailyGrainKey(input: {
  integrationId: string;
  adAccountId: string;
  entityType: string;
  entityExternalId: string;
  metricDate: string;
}): string {
  return [
    input.integrationId,
    input.adAccountId,
    input.entityType,
    input.entityExternalId,
    input.metricDate,
  ].join("|");
}
