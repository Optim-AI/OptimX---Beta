'use client';

import React, { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { ArcSpinner, StepProgress } from '@/app/web/src/components/ui/loaders';
import colors from '@/lib/ui/colors';
import { BasisChip } from '@/app/web/src/components/research/BrandResearchReport';
import type { StrategyAngle, StrategyBrief } from '@/lib/research/product-strategy';

const STAGES = [
  'Looking at what buyers compare it with…',
  'Reading reviews, Reddit and forums…',
  'Checking how competitors advertise…',
  'Finding the insight and positioning…',
  'Writing angles and the campaign plan…',
];

/** Staged progress for the ~45s research + strategy run. */
export function StrategyLoading() {
  return (
    <div className="py-8">
      <StepProgress steps={STAGES} estimatedMs={45_000} hint="researching this product's market first, about 45 seconds" />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{label}</div>
      <div className="mt-1 text-sm leading-relaxed" style={{ color: colors.foreground }}>{children}</div>
    </div>
  );
}

const STAGE_LABEL = ['', 'New category', 'Growing', 'Crowded claims', 'Mechanism race', 'Jaded buyers'];

export function StrategyBriefPanel({ brief }: { brief: StrategyBrief }) {
  const [open, setOpen] = useState(false);
  const s = brief.situation;
  return (
    <section className="rounded-xl border p-6" style={{ background: colors.card, borderColor: colors.border }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>Strategy</h2>
          <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>
            {brief.research === 'web'
              ? `Built from live market research${brief.sources.length ? ` (${brief.sources.length} sources)` : ''}`
              : brief.research === 'brand_research'
                ? 'Built from your brand research'
                : 'Built from the product page only — web research was unavailable'}
            {brief.alignedWithBrandResearch && (
              <>
                {' · '}
                <a href="/brand-research" className="underline" style={{ color: colors.primary }}>
                  consistent with your Brand Research
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full px-2.5 py-1" style={{ background: colors.secondary, color: colors.foreground }}>
            Market: stage {s.sophistication.stage} · {STAGE_LABEL[s.sophistication.stage]}
          </span>
          <span className="rounded-full px-2.5 py-1" style={{ background: colors.secondary, color: colors.foreground }}>
            Buyer: {s.awareness.level}
          </span>
        </div>
      </div>

      {brief.big_idea.line && (
        <div className="mt-5 rounded-xl p-4" style={{ background: 'hsl(213 100% 55% / 0.08)', border: '1px solid hsl(213 100% 55% / 0.25)' }}>
          <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: colors.primary }}>
            Big idea{brief.big_idea.name ? ` · ${brief.big_idea.name}` : ''}
          </div>
          <p className="mt-1 text-lg font-medium leading-snug" style={{ color: colors.foreground }}>{brief.big_idea.line}</p>
          {brief.big_idea.why && <p className="mt-1.5 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>{brief.big_idea.why}</p>}
        </div>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Row label="The insight">
          {brief.core_insight.truth}
          {brief.core_insight.tension && <span style={{ color: colors.mutedForeground }}> {brief.core_insight.tension}</span>}
          <div className="mt-1.5 flex items-start gap-2">
            <BasisChip basis={brief.core_insight.basis} />
            {brief.core_insight.evidence && (
              <span className="text-xs" style={{ color: colors.mutedForeground }}>{brief.core_insight.evidence}</span>
            )}
          </div>
        </Row>
        <Row label="Positioning">{brief.positioning}</Row>
        <Row label="Primary buyer">
          {brief.primary_audience.who}
          {brief.primary_audience.moment && (
            <div className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>Moment: {brief.primary_audience.moment}</div>
          )}
          {brief.primary_audience.barrier && (
            <div className="text-xs" style={{ color: colors.mutedForeground }}>Holding them back: {brief.primary_audience.barrier}</div>
          )}
        </Row>
        <Row label="What it means for the ads">
          {s.sophistication.implication}
          {s.awareness.implication && <div className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>{s.awareness.implication}</div>}
        </Row>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-5 inline-flex items-center gap-1 text-xs font-medium"
        style={{ color: colors.primary }}
        aria-expanded={open}
      >
        {open ? 'Hide' : 'Show'} competitors, objections and measurement
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {brief.alternatives.length > 0 && (
            <Row label="What buyers compare it with">
              <ul className="space-y-1.5">
                {brief.alternatives.map((a) => (
                  <li key={a.name}>
                    {a.name}
                    {a.price && <span style={{ color: colors.mutedForeground }}> · {a.price}</span>}
                    {a.claim && <div className="text-xs" style={{ color: colors.mutedForeground }}>Claims: {a.claim}</div>}
                  </li>
                ))}
              </ul>
              {s.competitive_frame && <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>{s.competitive_frame}</p>}
            </Row>
          )}
          {brief.objections.length > 0 && (
            <Row label="Why people don't buy — and the answer">
              <ul className="space-y-2.5">
                {brief.objections.map((o) => (
                  <li key={o.objection}>
                    <div>{o.objection}</div>
                    <div className="text-xs" style={{ color: colors.mutedForeground }}>Answer: {o.answer}{o.proof ? ` Show: ${o.proof}` : ''}</div>
                  </li>
                ))}
              </ul>
            </Row>
          )}
          {brief.avoid.length > 0 && (
            <Row label="Avoid">
              <ul className="list-disc space-y-1.5 pl-4">
                {brief.avoid.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </Row>
          )}
          {(brief.measurement.primary_kpi || brief.measurement.decision_rule) && (
            <Row label="How to measure">
              {brief.measurement.primary_kpi && <div>KPI: {brief.measurement.primary_kpi}</div>}
              {brief.measurement.early_signal && <div className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>Week 1 signal: {brief.measurement.early_signal}</div>}
              {brief.measurement.decision_rule && <div className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>Scale or stop: {brief.measurement.decision_rule}</div>}
            </Row>
          )}
          {brief.sources.length > 0 && (
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {brief.sources.map((src) => (
                <a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs hover:underline"
                  style={{ background: colors.secondary, color: colors.mutedForeground }}
                >
                  {src.title} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

type AngleLike = Partial<StrategyAngle> & { title: string; explanation: string };

/** Chips + expandable reasoning for one angle (no-ops for older saved angles). */
export function AngleMeta({ angle }: { angle: AngleLike }) {
  const [open, setOpen] = useState(false);
  if (!angle.insight && !angle.message) return null;
  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {angle.angle && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: colors.muted, color: colors.foreground }}>{angle.angle}</span>
        )}
        {angle.funnel && (
          <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: colors.muted, color: colors.mutedForeground }}>{angle.funnel}</span>
        )}
        {angle.basis && <BasisChip basis={angle.basis} />}
      </div>
      {angle.message && <p className="mt-1.5 text-xs leading-relaxed" style={{ color: colors.foreground }}>{angle.message}</p>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1 inline-flex items-center gap-1 text-[11px]"
        style={{ color: colors.mutedForeground }}
        aria-expanded={open}
      >
        Why this angle <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <dl className="mt-1.5 space-y-1 text-[11px] leading-relaxed" style={{ color: colors.mutedForeground }}>
          {angle.insight && <div><dt className="inline font-medium" style={{ color: colors.foreground }}>Insight: </dt><dd className="inline">{angle.insight}</dd></div>}
          {angle.evidence && <div><dt className="inline font-medium" style={{ color: colors.foreground }}>Evidence: </dt><dd className="inline">{angle.evidence}</dd></div>}
          {angle.audience && <div><dt className="inline font-medium" style={{ color: colors.foreground }}>For: </dt><dd className="inline">{angle.audience}{angle.awareness ? ` (${angle.awareness})` : ''}</dd></div>}
          {angle.proof && <div><dt className="inline font-medium" style={{ color: colors.foreground }}>Show: </dt><dd className="inline">{angle.proof}</dd></div>}
          {angle.why_it_wins && <div><dt className="inline font-medium" style={{ color: colors.foreground }}>Why it wins: </dt><dd className="inline">{angle.why_it_wins}</dd></div>}
          {angle.test && <div><dt className="inline font-medium" style={{ color: colors.foreground }}>Test: </dt><dd className="inline">{angle.test}</dd></div>}
        </dl>
      )}
    </div>
  );
}

/** Text handed to poster/video generation: the hook plus what the ad must say and show. */
export function angleCreativeBrief(angle: AngleLike): string {
  const parts = [angle.title];
  if (angle.message) parts.push(angle.message);
  else if (angle.explanation) parts.push(angle.explanation);
  if (angle.proof) parts.push(`Show: ${angle.proof}`);
  if (angle.audience) parts.push(`For: ${angle.audience}`);
  return parts.filter(Boolean).join(". ");
}
