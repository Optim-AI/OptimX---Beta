'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, RefreshCw } from 'lucide-react';
import { ArcSpinner, StepProgress } from '@/app/web/src/components/ui/loaders';
import colors from '@/lib/ui/colors';
import type { BrandResearch, EvidenceBasis, ResearchInsight } from '@/lib/research/brand-research';
import type { CompetitorAdsEntry, CompetitorAdsReport } from '@/lib/research/competitor-ads';
import { adLibrarySearchUrl, countryCodeFor } from '@/lib/research/ad-library-links';

const BASIS: Record<EvidenceBasis, { label: string; fg: string; bg: string }> = {
  site: { label: 'From your site', fg: 'hsl(142 70% 60%)', bg: 'hsl(142 70% 40% / 0.14)' },
  web: { label: 'From the web', fg: 'hsl(213 100% 70%)', bg: 'hsl(213 100% 55% / 0.14)' },
  inferred: { label: 'Our read', fg: 'hsl(0 0% 70%)', bg: 'hsl(0 0% 100% / 0.07)' },
};

export function BasisChip({ basis }: { basis: EvidenceBasis }) {
  const b = BASIS[basis];
  return (
    <span className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ color: b.fg, background: b.bg }}>
      {b.label}
    </span>
  );
}

function Card(props: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl p-5 ${props.className || ''}`} style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <h2 className="text-sm font-semibold" style={{ color: colors.foreground }}>{props.title}</h2>
      {props.hint && <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>{props.hint}</p>}
      <div className="mt-4">{props.children}</div>
    </section>
  );
}

function InsightList({ items, empty }: { items: ResearchInsight[]; empty: string }) {
  if (!items.length) return <p className="text-xs" style={{ color: colors.mutedForeground }}>{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it, i) => (
        <li key={i}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-snug" style={{ color: colors.foreground }}>{it.insight}</p>
            <BasisChip basis={it.basis} />
          </div>
          {it.evidence && (
            <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>
              {it.evidence}
              {it.source && <span className="opacity-80"> — {it.source}</span>}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

const STAGE_LABEL = ['', 'New category', 'Growing', 'Crowded claims', 'Mechanism race', 'Jaded buyers'];

function SophisticationMeter({ stage }: { stage: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Market sophistication stage ${stage} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="h-1.5 flex-1 rounded-full" style={{ background: n <= stage ? colors.primary : colors.muted }} />
      ))}
    </div>
  );
}

function evidenceLine(r: BrandResearch): string {
  const e = r.evidence;
  const bits = [`${e.pages_read} page${e.pages_read === 1 ? '' : 's'} of your site`];
  if (e.products_found) bits.push(`${e.products_found} product${e.products_found === 1 ? '' : 's'}`);
  if (e.web_sources) bits.push(`${e.web_sources} web sources`);
  return `Based on ${bits.join(' · ')}`;
}

export function ResearchPending({ label = 'Researching your market' }: { label?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.15em]" style={{ color: colors.mutedForeground }}>{label}</p>
      <StepProgress
        className="max-w-md"
        estimatedMs={70_000}
        hint="about a minute — it keeps running if you carry on"
        steps={[
          'Reading your website…',
          'Finding who you compete with…',
          'Reading what buyers say on Reddit and in reviews…',
          'Comparing prices and positioning…',
          'Writing your market read…',
        ]}
      />
    </div>
  );
}

/** Onboarding: the three things worth reading in 20 seconds. */
export function BrandResearchHighlights({ research }: { research: BrandResearch }) {
  const frustrations = research.customer_voice.frustrations.slice(0, 3);
  return (
    <div className="rounded-2xl p-5 sm:p-6 space-y-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div>
        <div className="text-xs uppercase tracking-[0.15em] mb-2" style={{ color: colors.mutedForeground }}>Market read</div>
        <p className="text-sm leading-relaxed" style={{ color: colors.foreground }}>{research.summary}</p>
        <p className="mt-2 text-[11px]" style={{ color: colors.mutedForeground }}>{evidenceLine(research)}</p>
      </div>

      {research.competitors.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-[0.15em] mb-2" style={{ color: colors.mutedForeground }}>Who you&apos;re up against</div>
          <div className="flex flex-wrap gap-2">
            {research.competitors.slice(0, 5).map((c) => (
              <span key={c.name} className="rounded-lg px-2.5 py-1 text-xs" style={{ background: colors.secondary, color: colors.foreground }}>
                {c.name}
                {c.price_point && <span style={{ color: colors.mutedForeground }}> · {c.price_point.slice(0, 40)}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {frustrations.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-[0.15em] mb-2" style={{ color: colors.mutedForeground }}>What buyers complain about</div>
          <ul className="space-y-1.5">
            {frustrations.map((f, i) => (
              <li key={i} className="text-sm" style={{ color: colors.foreground }}>
                {f.insight}
                {f.source && <span className="text-xs" style={{ color: colors.mutedForeground }}> — {f.source}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {research.opportunities[0] && (
        <div className="rounded-xl p-4" style={{ background: 'hsl(213 100% 55% / 0.08)', border: '1px solid hsl(213 100% 55% / 0.25)' }}>
          <div className="text-xs uppercase tracking-[0.15em] mb-1" style={{ color: colors.primary }}>Biggest opportunity</div>
          <p className="text-sm font-medium" style={{ color: colors.foreground }}>{research.opportunities[0].title}</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>{research.opportunities[0].play}</p>
        </div>
      )}

      <Link href="/brand-research" className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: colors.primary }}>
        See the full research <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

type FullProps = {
  research: BrandResearch;
  onRefresh?: () => void;
  refreshing?: boolean;
  onCheckAds?: () => void;
  checkingAds?: boolean;
};

function daysLabel(d?: number): string {
  if (d === undefined) return '';
  if (d < 1) return 'started today';
  if (d < 60) return `running ${d} days`;
  return `running ${Math.round(d / 30)} months`;
}

function CompetitorAdsCard({ research, onCheckAds, checkingAds }: { research: BrandResearch; onCheckAds?: () => void; checkingAds?: boolean }) {
  const report: CompetitorAdsReport | undefined = research.competitor_ads;
  const country = report?.country ?? countryCodeFor(research.snapshot.market);
  const entries: CompetitorAdsEntry[] =
    report?.competitors ??
    research.competitors.map((c) => ({ name: c.name, libraryUrl: adLibrarySearchUrl(c.name, country), activeAds: 0, ads: [] }));
  const withAds = entries.filter((e) => e.ads.length);
  const note =
    report?.status === 'ok'
      ? null
      : report?.status === 'none_found'
        ? "Meta only shares ad details through its API for ads shown in the EU, so these competitors' ads can't be read here. Open their live ads directly:"
        : "Live ad details aren't available right now. Open each competitor's live ads in Meta's Ad Library:";

  return (
    <Card title="Competitor ads" hint="What your competitors are running on Facebook and Instagram right now. Ads that have run for months are usually the ones that work.">
      {report?.status === 'ok' && (report.patterns.length > 0 || report.implication) && (
        <div className="mb-5 rounded-xl p-4" style={{ background: colors.secondary }}>
          {report.patterns.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-sm" style={{ color: colors.foreground }}>
              {report.patterns.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {report.implication && <p className="mt-2 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}><strong style={{ color: colors.foreground }}>For you: </strong>{report.implication}</p>}
        </div>
      )}

      {withAds.length > 0 && (
        <div className="space-y-5">
          {withAds.map((e) => (
            <div key={e.name}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                  {e.name} <span className="text-xs font-normal" style={{ color: colors.mutedForeground }}>· {e.activeAds} active ad{e.activeAds === 1 ? '' : 's'}</span>
                </p>
                <a href={e.libraryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: colors.primary }}>
                  All their ads <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {e.leadsWith && <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>Leads with: {e.leadsWith}</p>}
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {e.ads.map((a) => (
                  <a key={a.id} href={a.libraryUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg p-3 transition-colors hover:brightness-110" style={{ background: colors.secondary }}>
                    {a.title && <p className="text-xs font-medium" style={{ color: colors.foreground }}>{a.title}</p>}
                    <p className="mt-0.5 line-clamp-4 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>{a.body}</p>
                    <p className="mt-2 text-[10px]" style={{ color: colors.mutedForeground }}>
                      {[daysLabel(a.daysRunning), a.platforms.map((p) => p.toLowerCase()).join(', ')].filter(Boolean).join(' · ')}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(note || withAds.length < entries.length) && (
        <div className={withAds.length ? 'mt-5' : ''}>
          {note && <p className="mb-3 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>{note}</p>}
          <div className="flex flex-wrap gap-2">
            {entries
              .filter((e) => !e.ads.length)
              .map((e) => (
                <a key={e.name} href={e.libraryUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs hover:underline" style={{ background: colors.secondary, color: colors.foreground }}>
                  See {e.name}&apos;s live ads <ExternalLink className="h-3 w-3" />
                </a>
              ))}
          </div>
        </div>
      )}

      {onCheckAds && report?.status !== 'ok' && (
        <button
          type="button"
          onClick={onCheckAds}
          disabled={checkingAds}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium disabled:opacity-60"
          style={{ color: colors.primary }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${checkingAds ? 'animate-spin' : ''}`} /> {checkingAds ? 'Checking…' : 'Check their ads again'}
        </button>
      )}
    </Card>
  );
}

export default function BrandResearchReport({ research: r, onRefresh, refreshing, onCheckAds, checkingAds }: FullProps) {
  const cv = r.customer_voice;
  return (
    <div className="space-y-5">
      <Card title="The read">
        <p className="text-[15px] leading-relaxed" style={{ color: colors.foreground }}>{r.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Category', r.snapshot.category],
            ['Business model', r.snapshot.business_model],
            ['Market', r.snapshot.market],
            ['Price point', r.snapshot.price_point],
          ].map(([k, v]) =>
            v ? (
              <div key={k} className="rounded-lg p-3" style={{ background: colors.secondary }}>
                <div className="text-[11px]" style={{ color: colors.mutedForeground }}>{k}</div>
                <div className="mt-0.5 text-sm" style={{ color: colors.foreground }}>{v}</div>
              </div>
            ) : null
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs" style={{ color: colors.mutedForeground }}>
            {evidenceLine(r)} · {new Date(r.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
              style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Researching…' : 'Run again'}
            </button>
          )}
        </div>
        {r.evidence.notes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {r.evidence.notes.map((n) => (
              <li key={n} className="text-xs" style={{ color: 'hsl(38 92% 65%)' }}>{n}</li>
            ))}
          </ul>
        )}
      </Card>

      {r.opportunities.length > 0 && (
        <Card title="Where to win" hint="The highest-leverage moves, each tied to what the research found.">
          <div className="grid gap-3 md:grid-cols-3">
            {r.opportunities.map((o, i) => (
              <div key={i} className="rounded-xl p-4" style={{ background: colors.secondary }}>
                <div className="text-xs font-semibold" style={{ color: colors.primary }}>{String(i + 1).padStart(2, '0')}</div>
                <p className="mt-1 text-sm font-medium" style={{ color: colors.foreground }}>{o.title}</p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}><strong style={{ color: colors.foreground }}>Why: </strong>{o.why}</p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}><strong style={{ color: colors.foreground }}>Play: </strong>{o.play}</p>
                {o.evidence && <p className="mt-2 text-[11px] leading-relaxed opacity-80" style={{ color: colors.mutedForeground }}>Evidence: {o.evidence}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Positioning" hint="What you claim, and whether the site proves it.">
          {r.positioning.claimed && (
            <p className="text-sm italic" style={{ color: colors.foreground }}>&ldquo;{r.positioning.claimed}&rdquo;</p>
          )}
          {r.positioning.verdict && <p className="mt-3 text-sm" style={{ color: colors.foreground }}>{r.positioning.verdict}</p>}
          <div className="mt-4">
            <div className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Proof you have</div>
            <InsightList items={r.positioning.proof_points} empty="No proof points found on the site." />
          </div>
          {r.positioning.gaps.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Gaps</div>
              <ul className="list-disc space-y-1.5 pl-4">
                {r.positioning.gaps.map((g, i) => (
                  <li key={i} className="text-sm" style={{ color: colors.foreground }}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Who buys, and when">
          <div className="space-y-3">
            {r.audiences.map((a, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: colors.secondary }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium" style={{ color: colors.foreground }}>{a.segment}</p>
                  <BasisChip basis={a.basis} />
                </div>
                <dl className="mt-2 space-y-1 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>
                  <div><dt className="inline font-medium" style={{ color: colors.foreground }}>Hires it to: </dt><dd className="inline">{a.job_to_be_done}</dd></div>
                  <div><dt className="inline font-medium" style={{ color: colors.foreground }}>Starts looking when: </dt><dd className="inline">{a.trigger_moment}</dd></div>
                  <div><dt className="inline font-medium" style={{ color: colors.foreground }}>Needs to hear: </dt><dd className="inline">{a.what_they_need_to_hear}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Competitors" hint={r.competitors.length ? 'Brands your buyers compare you with, found on the web.' : undefined}>
        {r.competitors.length === 0 ? (
          <p className="text-xs" style={{ color: colors.mutedForeground }}>Competitor search was unavailable for this run.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr style={{ color: colors.mutedForeground }}>
                  {['Brand', 'Price', 'Positioning', 'Strength', 'Weakness', 'How you win'].map((h) => (
                    <th key={h} className="px-2 pb-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.competitors.map((c) => (
                  <tr key={c.name} className="align-top" style={{ borderTop: `1px solid ${colors.border}` }}>
                    <td className="px-2 py-3">
                      <div className="text-sm font-medium" style={{ color: colors.foreground }}>{c.name}</div>
                      {c.flagship && <div className="mt-0.5" style={{ color: colors.mutedForeground }}>{c.flagship}</div>}
                    </td>
                    <td className="px-2 py-3" style={{ color: colors.foreground }}>{c.price_point || '—'}</td>
                    <td className="px-2 py-3" style={{ color: colors.mutedForeground }}>{c.positioning}</td>
                    <td className="px-2 py-3" style={{ color: colors.mutedForeground }}>{c.strength}</td>
                    <td className="px-2 py-3" style={{ color: colors.mutedForeground }}>{c.weakness}</td>
                    <td className="px-2 py-3" style={{ color: colors.foreground }}>{c.how_to_win}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {r.competitors.length > 0 && <CompetitorAdsCard research={r} onCheckAds={onCheckAds} checkingAds={checkingAds} />}

      <Card title="What buyers say" hint="From Reddit, reviews and forums about your category.">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <div className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>They want</div>
            <InsightList items={cv.desires} empty="Nothing found." />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>They&apos;re frustrated by</div>
            <InsightList items={cv.frustrations} empty="Nothing found." />
          </div>
          <div>
            <div className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Before buying they worry</div>
            <InsightList items={cv.objections} empty="Nothing found." />
          </div>
        </div>
        {cv.their_words.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>In their words</div>
            <div className="flex flex-wrap gap-2">
              {cv.their_words.map((w) => (
                <span key={w} className="rounded-full px-3 py-1 text-xs" style={{ background: colors.secondary, color: colors.foreground }}>&ldquo;{w}&rdquo;</span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Market" hint="How hard buyers are to impress, and which claims no longer work.">
          <div className="flex items-center justify-between text-xs" style={{ color: colors.mutedForeground }}>
            <span>Sophistication: stage {r.market.sophistication.stage} of 5</span>
            <span style={{ color: colors.foreground }}>{STAGE_LABEL[r.market.sophistication.stage]}</span>
          </div>
          <div className="mt-2"><SophisticationMeter stage={r.market.sophistication.stage} /></div>
          {r.market.sophistication.meaning && (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: colors.foreground }}>{r.market.sophistication.meaning}</p>
          )}
          {r.market.saturated_claims.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Claims everyone makes (avoid leading with these)</div>
              <div className="flex flex-wrap gap-2">
                {r.market.saturated_claims.map((c) => (
                  <span key={c} className="rounded-full px-3 py-1 text-xs line-through decoration-1" style={{ background: colors.secondary, color: colors.mutedForeground }}>{c}</span>
                ))}
              </div>
            </div>
          )}
          {r.market.whitespace.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Open positions you could own</div>
              <ul className="list-disc space-y-1.5 pl-4">
                {r.market.whitespace.map((w) => (
                  <li key={w} className="text-sm" style={{ color: colors.foreground }}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Your website" hint="What's likely costing you sales right now.">
          {r.site_findings.length === 0 ? (
            <p className="text-xs" style={{ color: colors.mutedForeground }}>No issues found.</p>
          ) : (
            <ul className="space-y-3">
              {r.site_findings.map((f, i) => (
                <li key={i} className="rounded-lg p-3" style={{ background: colors.secondary }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm" style={{ color: colors.foreground }}>{f.finding}</p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium uppercase"
                      style={{
                        color: f.impact === 'high' ? 'hsl(0 84% 70%)' : f.impact === 'medium' ? 'hsl(38 92% 65%)' : colors.mutedForeground,
                        background: f.impact === 'high' ? 'hsl(0 84% 55% / 0.14)' : f.impact === 'medium' ? 'hsl(38 92% 50% / 0.14)' : colors.muted,
                      }}
                    >
                      {f.impact}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>Fix: {f.fix}</p>
                </li>
              ))}
            </ul>
          )}
          {(r.reputation.summary || r.reputation.ratings.length > 0) && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs font-medium" style={{ color: colors.mutedForeground }}>
                <span>Reputation online</span>
                <BasisChip basis={r.reputation.basis} />
              </div>
              {r.reputation.ratings.length > 0 && (
                <p className="text-sm font-medium" style={{ color: colors.foreground }}>{r.reputation.ratings.join(' · ')}</p>
              )}
              {r.reputation.summary && <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>{r.reputation.summary}</p>}
            </div>
          )}
        </Card>
      </div>

      {r.sources.length > 0 && (
        <Card title="Sources">
          <div className="flex flex-wrap gap-2">
            {r.sources.map((s) => (
              <a
                key={s.url}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs hover:underline"
                style={{ background: colors.secondary, color: colors.mutedForeground }}
              >
                {s.title} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
