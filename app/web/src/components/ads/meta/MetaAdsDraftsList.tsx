"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  AlertTriangle,
  Archive,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import Sidebar from "@/app/web/src/components/Sidebar";
import { Button } from "@/app/web/src/components/ui/button";
import { Card, CardContent } from "@/app/web/src/components/ui/card";
import colors from "@/lib/ui/colors";
import type { MetaAdsPreflightResult } from "@/lib/ads/meta/preflight";
import {
  archiveMetaAdsDraft,
  fetchMetaAdsPreflight,
  humanizeMetaAdsDraftError,
  listMetaAdsDrafts,
  type MetaAdsDraftDto,
} from "@/lib/ads/meta/draft-client";
import { MetaAdsStatusBadge } from "@/app/web/src/components/ads/meta/MetaAdsStatusBadge";
import {
  META_ADS_DRAFT_OBJECTIVE_LABELS,
  type MetaAdsDraftObjective,
} from "@/lib/ads/meta/draft-contract";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function objectiveLabel(code: string | null) {
  if (!code) return "—";
  const known = META_ADS_DRAFT_OBJECTIVE_LABELS[code as MetaAdsDraftObjective];
  return known?.title || code;
}

function isEditable(status: string) {
  return status === "draft" || status === "failed";
}

function isArchivable(status: string) {
  return status !== "archived" && status !== "creating";
}

export function MetaAdsDraftsList() {
  const router = useRouter();
  const [preflight, setPreflight] = React.useState<MetaAdsPreflightResult | null>(
    null
  );
  const [drafts, setDrafts] = React.useState<MetaAdsDraftDto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [archivingId, setArchivingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pf = await fetchMetaAdsPreflight();
      if (!pf.ok) {
        setError(humanizeMetaAdsDraftError(pf));
        setPreflight(null);
        setDrafts([]);
        return;
      }
      setPreflight(pf);

      if (!pf.entitled.entitled) {
        setDrafts([]);
        return;
      }

      const listed = await listMetaAdsDrafts(50);
      if (!listed.ok) {
        setError(humanizeMetaAdsDraftError(listed));
        setDrafts([]);
        return;
      }
      setDrafts(listed.drafts);
    } catch (e: any) {
      setError(e?.message || "Failed to load Meta Ads drafts");
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const canCreate = Boolean(preflight?.canCreateLocalDraft);
  const acct = preflight?.selectedAccount;

  const onArchive = async (id: string) => {
    if (!window.confirm("Archive this local draft? It will not affect Meta.")) {
      return;
    }
    setArchivingId(id);
    try {
      const res = await archiveMetaAdsDraft(id);
      if (!res.ok) {
        setError(humanizeMetaAdsDraftError(res));
        return;
      }
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? res.draft : d))
      );
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="min-h-screen flex app-page" data-testid="meta-ads-drafts-list">
      <Sidebar logoUrl="/brand/logo.png" onLogoClick={() => {}} />

      <div className="flex-1 min-w-0">
        <main className="max-w-6xl mx-auto p-6 pb-24">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Megaphone className="h-5 w-5" style={{ color: colors.primary }} />
                <h1 className="text-2xl font-semibold tracking-tight">
                  Meta Ads drafts
                </h1>
              </div>
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                Configure local paid Ads drafts in SkalX. Saving here does not
                create a campaign on Meta or spend budget.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void load()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1.5">Refresh</span>
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canCreate || loading}
                style={
                  canCreate
                    ? {
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                      }
                    : undefined
                }
                onClick={() => router.push("/ads/meta/drafts/new")}
                data-testid="create-ad-campaign"
              >
                <Plus className="h-4 w-4" />
                <span className="ml-1.5">Create ad campaign</span>
              </Button>
            </div>
          </div>

          {/* Account + preflight */}
          <Card className="mb-6 border" style={{ borderColor: colors.border, background: colors.card }}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>
                    Selected Meta Ads account
                  </p>
                  {acct?.present ? (
                    <p className="text-sm font-medium" data-testid="selected-account">
                      {acct.name || acct.externalId}{" "}
                      <span style={{ color: colors.mutedForeground }}>
                        · currency {acct.currency || "unknown"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm" style={{ color: colors.mutedForeground }}>
                      No account selected
                    </p>
                  )}
                </div>
                <Link
                  href="/integrations"
                  className="text-sm underline"
                  style={{ color: colors.primary }}
                >
                  Integrations
                </Link>
              </div>

              {preflight && preflight.blockers.length > 0 ? (
                <ul className="space-y-2" data-testid="preflight-blockers">
                  {preflight.blockers.map((b) => (
                    <li
                      key={b.code}
                      className="flex gap-2 rounded-lg border px-3 py-2 text-sm"
                      style={{
                        borderColor:
                          b.code === "page_not_bound"
                            ? "rgba(245,158,11,0.4)"
                            : "rgba(239,68,68,0.35)",
                        color:
                          b.code === "page_not_bound" ? "#f59e0b" : "#fca5a5",
                      }}
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        <span className="font-medium">{b.code}</span> — {b.message}
                        {b.code === "no_integration" ||
                        b.code === "no_selected_account" ||
                        b.code === "integration_disconnected" ? (
                          <>
                            {" "}
                            <Link href="/integrations" className="underline">
                              Connect Meta Ads
                            </Link>
                          </>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : preflight && !loading ? (
                <p className="text-sm" style={{ color: colors.green600 }}>
                  Ready to save local drafts
                  {!preflight.canCreateOnMeta
                    ? " (Page binding still required before Meta-side creation)."
                    : "."}
                </p>
              ) : null}

              <p className="text-xs" style={{ color: colors.mutedForeground }}>
                Analytics and organic publishing are separate. Local drafts are
                never Meta campaigns until a later create-on-Meta step.
              </p>
            </CardContent>
          </Card>

          {error ? (
            <div
              className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm"
              style={{ borderColor: colors.destructive, color: "#fca5a5" }}
              data-testid="list-error"
            >
              <span>{error}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : null}

          {loading ? (
            <div
              className="flex items-center gap-2 py-16 justify-center text-sm"
              style={{ color: colors.mutedForeground }}
              data-testid="list-loading"
            >
              <Loader2 className="h-5 w-5 animate-spin" /> Loading drafts…
            </div>
          ) : null}

          {!loading && preflight && !preflight.entitled.entitled ? (
            <Card
              className="border"
              style={{ borderColor: colors.border, background: colors.card }}
              data-testid="entitlement-denied"
            >
              <CardContent className="p-8 text-center">
                <p className="text-lg font-medium">Meta Ads drafts coming soon</p>
                <p className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>
                  {preflight.entitled.reason ||
                    "Paid Ads draft creation is not enabled for this environment."}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {!loading &&
          preflight?.entitled.entitled &&
          drafts.length === 0 &&
          !error ? (
            <Card
              className="border"
              style={{ borderColor: colors.border, background: colors.card }}
              data-testid="list-empty"
            >
              <CardContent className="p-10 text-center">
                <p className="text-lg font-medium">No Meta Ads drafts yet</p>
                <p className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>
                  Create a local draft to configure objective, budget, audience,
                  and creative. Nothing is sent to Meta until a later step.
                </p>
                {canCreate ? (
                  <Button
                    className="mt-4"
                    type="button"
                    onClick={() => router.push("/ads/meta/drafts/new")}
                    style={{
                      background: colors.gradientPrimary,
                      color: colors.primaryForeground,
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create ad campaign
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {!loading && drafts.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: colors.border }}>
              <table className="w-full min-w-[640px] text-left text-sm" data-testid="drafts-table">
                <thead>
                  <tr style={{ background: colors.muted, color: colors.mutedForeground }}>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Objective</th>
                    <th className="px-4 py-3 font-medium">Budget</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drafts.map((d) => (
                    <tr
                      key={d.id}
                      className="border-t"
                      style={{ borderColor: colors.border }}
                    >
                      <td className="px-4 py-3 font-medium">
                        {d.name || "Untitled draft"}
                      </td>
                      <td className="px-4 py-3">{objectiveLabel(d.objective)}</td>
                      <td className="px-4 py-3" data-testid="draft-budget">
                        {d.dailyBudgetMajor != null
                          ? `${d.dailyBudgetMajor} ${d.currency}`
                          : `— ${d.currency}`}
                      </td>
                      <td className="px-4 py-3">
                        <MetaAdsStatusBadge
                          status={d.status}
                          onMeta={d.onMeta}
                          metaCampaignId={d.metaCampaignId}
                        />
                      </td>
                      <td className="px-4 py-3" style={{ color: colors.mutedForeground }}>
                        {fmtDate(d.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              router.push(`/ads/meta/drafts/${d.id}`)
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="ml-1">
                              {isEditable(d.status) ? "Edit" : "Open"}
                            </span>
                          </Button>
                          {isArchivable(d.status) ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={archivingId === d.id}
                              onClick={() => void onArchive(d.id)}
                            >
                              {archivingId === d.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Archive className="h-3.5 w-3.5" />
                              )}
                              <span className="ml-1">Archive</span>
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <p className="mt-6 text-xs" style={{ color: colors.mutedForeground }}>
            Separate from{" "}
            <Link href="/library" className="underline">
              Campaign Library
            </Link>
            ,{" "}
            <Link href="/analytics" className="underline">
              Analytics
            </Link>
            , and organic publishing in Generated Contents.
          </p>
        </main>
      </div>
    </div>
  );
}
