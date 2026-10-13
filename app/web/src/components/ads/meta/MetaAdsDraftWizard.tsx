"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import Sidebar from "@/app/web/src/components/Sidebar";
import { Button } from "@/app/web/src/components/ui/button";
import { Input } from "@/app/web/src/components/ui/input";
import { Textarea } from "@/app/web/src/components/ui/textarea";
import { Label } from "@/app/web/src/components/ui/label";
import { Card, CardContent } from "@/app/web/src/components/ui/card";
import colors from "@/lib/ui/colors";
import type { MetaAdsPreflightResult } from "@/lib/ads/meta/preflight";
import {
  createMetaAdsDraft,
  fetchMetaAdsPreflight,
  getMetaAdsDraft,
  humanizeMetaAdsDraftError,
  updateMetaAdsDraft,
  type MetaAdsDraftDto,
} from "@/lib/ads/meta/draft-client";
import {
  META_ADS_DRAFT_COUNTRIES,
  META_ADS_DRAFT_COUNTRY_LABELS,
  META_ADS_DRAFT_CTAS,
  META_ADS_DRAFT_CTA_LABELS,
  META_ADS_DRAFT_OBJECTIVES,
  META_ADS_DRAFT_OBJECTIVE_LABELS,
  defaultMetaAdsDraftPlacements,
  defaultMetaAdsDraftTargeting,
  isPublicHttpsUrl,
  parseMetaAdsDraftPlacements,
  parseMetaAdsDraftTargeting,
  type MetaAdsDraftCountry,
  type MetaAdsDraftCta,
  type MetaAdsDraftObjective,
  type MetaAdsDraftPlacements,
  type MetaAdsDraftTargeting,
} from "@/lib/ads/meta/draft-contract";
import { MetaAdsCreativePicker } from "@/app/web/src/components/ads/meta/MetaAdsCreativePicker";
import { MetaAdsStatusBadge } from "@/app/web/src/components/ads/meta/MetaAdsStatusBadge";

const STEPS = [
  { id: "objective", title: "Objective" },
  { id: "budget", title: "Budget & schedule" },
  { id: "audience", title: "Audience" },
  { id: "creative", title: "Creative & copy" },
  { id: "review", title: "Review & save" },
] as const;

type WizardState = {
  name: string;
  objective: MetaAdsDraftObjective | "";
  dailyBudgetMajor: string;
  scheduleStart: string;
  scheduleEnd: string;
  targeting: MetaAdsDraftTargeting;
  placements: MetaAdsDraftPlacements;
  sourceImageId: string | null;
  sourceImageUrl: string | null;
  primaryText: string;
  headline: string;
  destinationUrl: string;
  callToAction: MetaAdsDraftCta | "";
};

function emptyState(): WizardState {
  return {
    name: "",
    objective: "",
    dailyBudgetMajor: "",
    scheduleStart: "",
    scheduleEnd: "",
    targeting: defaultMetaAdsDraftTargeting(),
    placements: defaultMetaAdsDraftPlacements(),
    sourceImageId: null,
    sourceImageUrl: null,
    primaryText: "",
    headline: "",
    destinationUrl: "",
    callToAction: "",
  };
}

function draftToState(d: MetaAdsDraftDto): WizardState {
  const targeting =
    parseMetaAdsDraftTargeting(d.targeting) || defaultMetaAdsDraftTargeting();
  const placements =
    parseMetaAdsDraftPlacements(d.placements) ||
    defaultMetaAdsDraftPlacements();
  const toDateInput = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  };
  return {
    name: d.name || "",
    objective: (META_ADS_DRAFT_OBJECTIVES as readonly string[]).includes(
      d.objective || ""
    )
      ? (d.objective as MetaAdsDraftObjective)
      : "",
    dailyBudgetMajor:
      d.dailyBudgetMajor != null ? String(d.dailyBudgetMajor) : "",
    scheduleStart: toDateInput(d.scheduleStart),
    scheduleEnd: toDateInput(d.scheduleEnd),
    targeting,
    placements,
    sourceImageId: d.sourceImageId,
    sourceImageUrl: d.sourceImageUrl,
    primaryText: d.primaryText || "",
    headline: d.headline || "",
    destinationUrl: d.destinationUrl || "",
    callToAction: (META_ADS_DRAFT_CTAS as readonly string[]).includes(
      d.callToAction || ""
    )
      ? (d.callToAction as MetaAdsDraftCta)
      : "",
  };
}

function toIsoDate(dateOnly: string): string | null {
  if (!dateOnly.trim()) return null;
  return new Date(`${dateOnly.trim()}T00:00:00.000Z`).toISOString();
}

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `meta-ads-draft:${crypto.randomUUID()}`;
  }
  return `meta-ads-draft:${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function MetaAdsDraftWizard(props: { draftId?: string | null }) {
  const router = useRouter();
  const isEdit = Boolean(props.draftId);
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<WizardState>(emptyState);
  const [preflight, setPreflight] =
    React.useState<MetaAdsPreflightResult | null>(null);
  const [existing, setExisting] = React.useState<MetaAdsDraftDto | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [readOnly, setReadOnly] = React.useState(false);
  const idempotencyKeyRef = React.useRef<string>(newIdempotencyKey());
  const submitLockRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const pf = await fetchMetaAdsPreflight();
        if (cancelled) return;
        if (!pf.ok) {
          setError(humanizeMetaAdsDraftError(pf));
          return;
        }
        setPreflight(pf);

        if (props.draftId) {
          const got = await getMetaAdsDraft(props.draftId);
          if (cancelled) return;
          if (!got.ok) {
            setError(humanizeMetaAdsDraftError(got));
            return;
          }
          setExisting(got.draft);
          setState(draftToState(got.draft));
          const editable =
            got.draft.status === "draft" || got.draft.status === "failed";
          setReadOnly(!editable);
          if (got.draft.idempotencyKey) {
            idempotencyKeyRef.current = got.draft.idempotencyKey;
          }
        } else if (!pf.canCreateLocalDraft) {
          setError(
            pf.blockers.map((b) => b.message).join(" ") ||
              "Cannot create a local draft yet."
          );
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load wizard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.draftId]);

  const currency = existing?.currency || preflight?.selectedAccount.currency || null;

  const validateStep = (idx: number): string | null => {
    if (idx === 0) {
      if (!state.objective) return "Choose an objective to continue.";
      if (!state.name.trim()) return "Add a draft name.";
    }
    if (idx === 1) {
      const n = Number(state.dailyBudgetMajor);
      if (!Number.isFinite(n) || n <= 0) {
        return "Enter a positive daily budget in the account currency.";
      }
      if (!state.scheduleStart) return "Choose a start date.";
      if (state.scheduleEnd) {
        if (state.scheduleEnd < state.scheduleStart) {
          return "End date must be on or after the start date.";
        }
      }
    }
    if (idx === 2) {
      if (state.targeting.geoCountries.length === 0) {
        return "Select at least one country.";
      }
      if (state.targeting.ageMin > state.targeting.ageMax) {
        return "Minimum age cannot exceed maximum age.";
      }
    }
    if (idx === 3) {
      if (!state.sourceImageId || !state.sourceImageUrl) {
        return "Select a creative image.";
      }
      if (!state.primaryText.trim()) return "Enter primary text.";
      if (!state.headline.trim()) return "Enter a headline.";
      if (!isPublicHttpsUrl(state.destinationUrl)) {
        return "Destination must be a public https:// URL.";
      }
      if (!state.callToAction) return "Choose a call to action.";
    }
    return null;
  };

  const goNext = () => {
    const err = validateStep(step);
    if (err) {
      setFieldError(err);
      return;
    }
    setFieldError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setFieldError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const toggleCountry = (code: MetaAdsDraftCountry) => {
    setState((prev) => {
      const has = prev.targeting.geoCountries.includes(code);
      const geoCountries = has
        ? prev.targeting.geoCountries.filter((c) => c !== code)
        : [...prev.targeting.geoCountries, code];
      return {
        ...prev,
        targeting: { ...prev.targeting, geoCountries },
      };
    });
  };

  const buildPayload = () => ({
    name: state.name.trim() || null,
    objective: state.objective || null,
    dailyBudgetMajor: state.dailyBudgetMajor,
    scheduleStart: toIsoDate(state.scheduleStart),
    scheduleEnd: toIsoDate(state.scheduleEnd),
    targeting: state.targeting as unknown as Record<string, unknown>,
    placements: state.placements as unknown as Record<string, unknown>,
    sourceImageId: state.sourceImageId,
    sourceImageUrl: state.sourceImageUrl,
    primaryText: state.primaryText.trim() || null,
    headline: state.headline.trim() || null,
    destinationUrl: state.destinationUrl.trim() || null,
    callToAction: state.callToAction || null,
  });

  const onSave = async () => {
    for (let i = 0; i < STEPS.length - 1; i++) {
      const err = validateStep(i);
      if (err) {
        setStep(i);
        setFieldError(err);
        return;
      }
    }
    if (submitLockRef.current || saving || readOnly) return;
    submitLockRef.current = true;
    setSaving(true);
    setError(null);
    setFieldError(null);
    try {
      if (isEdit && props.draftId) {
        const res = await updateMetaAdsDraft(props.draftId, buildPayload());
        if (!res.ok) {
          setError(humanizeMetaAdsDraftError(res));
          return;
        }
        router.push(`/ads/meta/drafts/${res.draft.id}?saved=1`);
        return;
      }
      const res = await createMetaAdsDraft({
        ...buildPayload(),
        idempotencyKey: idempotencyKeyRef.current,
      });
      if (!res.ok) {
        setError(humanizeMetaAdsDraftError(res));
        return;
      }
      router.push(`/ads/meta/drafts/${res.draft.id}?saved=1`);
    } finally {
      setSaving(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="min-h-screen flex app-page" data-testid="meta-ads-draft-wizard">
      <Sidebar logoUrl="/brand/logo.png" onLogoClick={() => {}} />

      <div className="flex-1 min-w-0">
        <main className="max-w-3xl mx-auto p-6 pb-24">
          <div className="mb-6">
            <Link
              href="/ads/meta/drafts"
              className="inline-flex items-center text-sm"
              style={{ color: colors.mutedForeground }}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to drafts
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {isEdit ? "Edit Meta Ads draft" : "Create Meta Ads draft"}
            </h1>
            <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
              Local configuration only — saving does not spend money or create a
              Meta campaign.
            </p>
            {existing ? (
              <div className="mt-2">
                <MetaAdsStatusBadge
                  status={existing.status}
                  onMeta={existing.onMeta}
                  metaCampaignId={existing.metaCampaignId}
                />
              </div>
            ) : null}
            {currency ? (
              <p className="mt-2 text-sm" data-testid="wizard-currency">
                Account currency: <strong>{currency}</strong>
              </p>
            ) : null}
          </div>

          {/* Progress */}
          <ol className="mb-6 flex flex-wrap gap-2" data-testid="wizard-steps">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                  style={{
                    background: active
                      ? colors.accent
                      : done
                        ? "rgba(34,197,94,0.15)"
                        : colors.muted,
                    color: active
                      ? colors.accentForeground
                      : done
                        ? colors.green600
                        : colors.mutedForeground,
                  }}
                >
                  {done ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {s.title}
                </li>
              );
            })}
          </ol>

          {loading ? (
            <div
              className="flex items-center gap-2 py-16 justify-center text-sm"
              style={{ color: colors.mutedForeground }}
            >
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : null}

          {error && !loading ? (
            <div
              className="mb-4 rounded-lg border px-4 py-3 text-sm"
              style={{ borderColor: colors.destructive, color: "#fca5a5" }}
              data-testid="wizard-error"
            >
              {error}{" "}
              <Link href="/ads/meta/drafts" className="underline">
                Return to list
              </Link>
            </div>
          ) : null}

          {!loading && !error && readOnly ? (
            <div
              className="mb-4 rounded-lg border px-4 py-3 text-sm"
              style={{ borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" }}
            >
              This draft is not editable in its current status. You can open
              details below or return to the list.
            </div>
          ) : null}

          {!loading && (!error || existing) ? (
            <Card
              className="border"
              style={{ borderColor: colors.border, background: colors.card }}
            >
              <CardContent className="space-y-5 p-5">
                {fieldError ? (
                  <p className="text-sm" style={{ color: "#fca5a5" }} data-testid="field-error">
                    {fieldError}
                  </p>
                ) : null}

                {step === 0 ? (
                  <div className="space-y-4" data-testid="step-objective">
                    <div>
                      <Label htmlFor="draft-name">Draft name</Label>
                      <Input
                        id="draft-name"
                        className="mt-1.5"
                        value={state.name}
                        disabled={readOnly}
                        onChange={(e) =>
                          setState((s) => ({ ...s, name: e.target.value }))
                        }
                        placeholder="Spring traffic draft"
                      />
                    </div>
                    <div className="grid gap-3">
                      {META_ADS_DRAFT_OBJECTIVES.map((obj) => {
                        const meta = META_ADS_DRAFT_OBJECTIVE_LABELS[obj];
                        const active = state.objective === obj;
                        return (
                          <button
                            key={obj}
                            type="button"
                            disabled={readOnly}
                            className="skx-focus rounded-lg border px-4 py-3 text-left"
                            style={{
                              borderColor: active ? colors.primary : colors.border,
                              background: active ? colors.accent : "transparent",
                            }}
                            onClick={() =>
                              setState((s) => ({ ...s, objective: obj }))
                            }
                          >
                            <div className="font-medium">{meta.title}</div>
                            <div
                              className="text-sm"
                              style={{ color: colors.mutedForeground }}
                            >
                              {meta.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {step === 1 ? (
                  <div className="space-y-4" data-testid="step-budget">
                    <div>
                      <Label htmlFor="budget">
                        Daily budget ({currency || "account currency"})
                      </Label>
                      <Input
                        id="budget"
                        className="mt-1.5"
                        type="number"
                        min={0}
                        step="0.01"
                        value={state.dailyBudgetMajor}
                        disabled={readOnly}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            dailyBudgetMajor: e.target.value,
                          }))
                        }
                      />
                      <p
                        className="mt-1 text-xs"
                        style={{ color: colors.mutedForeground }}
                      >
                        Amount is in {currency || "the selected account currency"}{" "}
                        — never assumed as INR. Saving a draft does not charge
                        this budget.
                      </p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="start">Start date</Label>
                        <Input
                          id="start"
                          className="mt-1.5"
                          type="date"
                          value={state.scheduleStart}
                          disabled={readOnly}
                          onChange={(e) =>
                            setState((s) => ({
                              ...s,
                              scheduleStart: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="end">End date (optional)</Label>
                        <Input
                          id="end"
                          className="mt-1.5"
                          type="date"
                          value={state.scheduleEnd}
                          disabled={readOnly}
                          onChange={(e) =>
                            setState((s) => ({
                              ...s,
                              scheduleEnd: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="space-y-4" data-testid="step-audience">
                    <div>
                      <Label>Countries</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {META_ADS_DRAFT_COUNTRIES.map((code) => {
                          const on = state.targeting.geoCountries.includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={readOnly}
                              className="skx-focus rounded-md border px-2.5 py-1 text-xs"
                              style={{
                                borderColor: on ? colors.primary : colors.border,
                                background: on ? colors.accent : "transparent",
                              }}
                              onClick={() => toggleCountry(code)}
                            >
                              {META_ADS_DRAFT_COUNTRY_LABELS[code]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="ageMin">Min age</Label>
                        <Input
                          id="ageMin"
                          className="mt-1.5"
                          type="number"
                          min={18}
                          max={65}
                          value={state.targeting.ageMin}
                          disabled={readOnly}
                          onChange={(e) =>
                            setState((s) => ({
                              ...s,
                              targeting: {
                                ...s.targeting,
                                ageMin: Number(e.target.value) || 18,
                              },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="ageMax">Max age</Label>
                        <Input
                          id="ageMax"
                          className="mt-1.5"
                          type="number"
                          min={18}
                          max={65}
                          value={state.targeting.ageMax}
                          disabled={readOnly}
                          onChange={(e) =>
                            setState((s) => ({
                              ...s,
                              targeting: {
                                ...s.targeting,
                                ageMax: Number(e.target.value) || 65,
                              },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Placements</Label>
                      <div className="mt-2 grid gap-2">
                        {(
                          [
                            {
                              value: defaultMetaAdsDraftPlacements() as MetaAdsDraftPlacements,
                              label: "Automatic placements (recommended)",
                            },
                            {
                              value: {
                                mode: "manual",
                                positions: ["facebook_feed"],
                              } as MetaAdsDraftPlacements,
                              label: "Facebook Feed only",
                            },
                          ]
                        ).map((opt) => {
                          const active =
                            JSON.stringify(state.placements) ===
                            JSON.stringify(opt.value);
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              disabled={readOnly}
                              className="skx-focus rounded-lg border px-3 py-2 text-left text-sm"
                              style={{
                                borderColor: active
                                  ? colors.primary
                                  : colors.border,
                              }}
                              onClick={() =>
                                setState((s) => ({
                                  ...s,
                                  placements: opt.value,
                                }))
                              }
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-4" data-testid="step-creative">
                    {!readOnly ? (
                      <MetaAdsCreativePicker
                        selectedId={state.sourceImageId}
                        onSelect={(item) =>
                          setState((s) => ({
                            ...s,
                            sourceImageId: item?.id ?? null,
                            sourceImageUrl: item?.mediaUrl ?? null,
                          }))
                        }
                      />
                    ) : state.sourceImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={state.sourceImageUrl}
                        alt=""
                        className="h-40 w-40 rounded-lg object-cover"
                      />
                    ) : null}
                    <div>
                      <Label htmlFor="primary">Primary text</Label>
                      <Textarea
                        id="primary"
                        className="mt-1.5"
                        rows={3}
                        value={state.primaryText}
                        disabled={readOnly}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            primaryText: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="headline">Headline</Label>
                      <Input
                        id="headline"
                        className="mt-1.5"
                        value={state.headline}
                        disabled={readOnly}
                        onChange={(e) =>
                          setState((s) => ({ ...s, headline: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="url">Destination URL</Label>
                      <Input
                        id="url"
                        className="mt-1.5"
                        type="url"
                        placeholder="https://"
                        value={state.destinationUrl}
                        disabled={readOnly}
                        onChange={(e) =>
                          setState((s) => ({
                            ...s,
                            destinationUrl: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <Label>Call to action</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {META_ADS_DRAFT_CTAS.map((cta) => {
                          const on = state.callToAction === cta;
                          return (
                            <button
                              key={cta}
                              type="button"
                              disabled={readOnly}
                              className="skx-focus rounded-md border px-2.5 py-1 text-xs"
                              style={{
                                borderColor: on ? colors.primary : colors.border,
                                background: on ? colors.accent : "transparent",
                              }}
                              onClick={() =>
                                setState((s) => ({ ...s, callToAction: cta }))
                              }
                            >
                              {META_ADS_DRAFT_CTA_LABELS[cta]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}

                {step === 4 ? (
                  <div className="space-y-3 text-sm" data-testid="step-review">
                    <ReviewRow label="Name" value={state.name} />
                    <ReviewRow
                      label="Objective"
                      value={
                        state.objective
                          ? META_ADS_DRAFT_OBJECTIVE_LABELS[state.objective]
                              .title
                          : "—"
                      }
                    />
                    <ReviewRow
                      label="Daily budget"
                      value={`${state.dailyBudgetMajor} ${currency || ""}`}
                    />
                    <ReviewRow
                      label="Schedule"
                      value={`${state.scheduleStart || "—"}${
                        state.scheduleEnd ? ` → ${state.scheduleEnd}` : ""
                      }`}
                    />
                    <ReviewRow
                      label="Audience"
                      value={`${state.targeting.geoCountries.join(", ")} · ages ${state.targeting.ageMin}–${state.targeting.ageMax}`}
                    />
                    <ReviewRow
                      label="Placements"
                      value={
                        state.placements.mode === "automatic"
                          ? "Automatic"
                          : "Facebook Feed"
                      }
                    />
                    <ReviewRow label="Headline" value={state.headline} />
                    <ReviewRow label="Primary text" value={state.primaryText} />
                    <ReviewRow label="Destination" value={state.destinationUrl} />
                    <ReviewRow
                      label="CTA"
                      value={
                        state.callToAction
                          ? META_ADS_DRAFT_CTA_LABELS[state.callToAction]
                          : "—"
                      }
                    />
                    <p
                      className="rounded-lg border px-3 py-2 text-xs"
                      style={{
                        borderColor: colors.border,
                        color: colors.mutedForeground,
                      }}
                    >
                      Confirming saves a <strong>local SkalX draft</strong> only.
                      No Meta campaign is created and no budget is spent.
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goBack}
                    disabled={step === 0 || saving}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4" /> Back
                  </Button>
                  {step < STEPS.length - 1 ? (
                    <Button
                      type="button"
                      onClick={goNext}
                      disabled={readOnly}
                      style={{
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                      }}
                    >
                      Continue <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void onSave()}
                      disabled={saving || readOnly}
                      data-testid="save-draft"
                      style={{
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                      }}
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          Saving…
                        </>
                      ) : isEdit ? (
                        "Save changes"
                      ) : (
                        "Save local draft"
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function ReviewRow(props: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b pb-2 sm:flex-row sm:justify-between" style={{ borderColor: colors.border }}>
      <span style={{ color: colors.mutedForeground }}>{props.label}</span>
      <span className="font-medium sm:max-w-[60%] sm:text-right">{props.value}</span>
    </div>
  );
}
