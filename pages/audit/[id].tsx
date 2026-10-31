import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Info,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { ArcSpinner } from '@/app/web/src/components/ui/loaders';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import colors from '@/lib/ui/colors';
import { auditPricingPath, rememberAuditAttribution, trackAuditEvent } from '@/lib/audit/analytics';
import { AUDIT_STAGES, type AuditStageName, type PublicAudit, type SourceRef } from '@/lib/audit/types';

const STAGE_LABELS: Record<AuditStageName, string> = {
  site: 'Reading your website',
  brand: 'Understanding your brand',
  competitors: 'Finding competitors',
  posts: 'Collecting recent competitor posts',
  analysis: 'Writing your audit',
};

const POLL_MS = 2500;

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);
}

function isActive(a: PublicAudit | null) {
  return a?.status === 'queued' || a?.status === 'running';
}

export default function AuditPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const wantsContinue = router.query.continue === '1';

  const [audit, setAudit] = useState<PublicAudit | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const runInFlight = useRef(false);
  const continuedOnce = useRef(false);
  const viewedOnce = useRef(false);
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(Boolean(data.session)));
  }, []);

  const applyAudit = useCallback((next: PublicAudit) => {
    setAudit(next);
    setSelected((cur) => (cur == null ? next.selectedIdeaIndex : cur));
    const prev = lastStatus.current;
    lastStatus.current = next.status;
    if ((prev === 'running' || prev === 'queued') && (next.status === 'completed' || next.status === 'partial')) {
      trackAuditEvent('audit_completed', { status: next.status, host: next.host });
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    if (!id) return null;
    try {
      const res = await authFetch(`/api/audit/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return null;
      }
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || 'Failed to load');
      setLoadError(null);
      applyAudit(data.audit);
      return data.audit as PublicAudit;
    } catch {
      setLoadError("We're having trouble reaching the server. Retrying…");
      return null;
    }
  }, [id, applyAudit]);

  const startRun = useCallback(async () => {
    if (!id || runInFlight.current) return;
    runInFlight.current = true;
    try {
      const res = await authFetch(`/api/audit/${id}/run`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (data?.audit) {
        applyAudit(data.audit);
        setActionError(null);
        return;
      }
      if (!res.ok) {
        const code = typeof data?.code === 'string' ? data.code : '';
        setActionError(
          (typeof data?.error === 'string' && data.error) ||
            (code === 'audit_storage_unavailable'
              ? 'Audit storage is temporarily unavailable. Please retry in a few minutes.'
              : 'Something went wrong running your audit. You can retry — completed steps are kept.')
        );
      }
    } catch {
      // Request may be cut off by the network; polling picks up persisted progress.
      setActionError('The research request was interrupted. Retrying from saved progress…');
    } finally {
      runInFlight.current = false;
    }
  }, [id, applyAudit]);

  useEffect(() => {
    if (!id) return;
    fetchAudit().then((a) => {
      if (a && (a.status === 'queued' || (a.status === 'running' && a.canRetry))) void startRun();
    });
  }, [id, fetchAudit, startRun]);

  useEffect(() => {
    if (!id || !isActive(audit)) return;
    const t = setInterval(async () => {
      const a = await fetchAudit();
      if (a?.status === 'running' && a.canRetry && !runInFlight.current) void startRun();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [id, audit, fetchAudit, startRun]);

  const hasResults = audit?.status === 'completed' || audit?.status === 'partial';

  useEffect(() => {
    if (hasResults && audit && !viewedOnce.current) {
      viewedOnce.current = true;
      trackAuditEvent('audit_results_viewed', { status: audit.status, host: audit.host });
    }
  }, [hasResults, audit]);

  const retry = async () => {
    setActionError(null);
    if (audit) setAudit({ ...audit, status: 'running', error: null });
    lastStatus.current = 'running';
    await startRun();
  };

  const chooseIdea = async (index: number) => {
    setSelected(index);
    setActionError(null);
    trackAuditEvent('audit_idea_selected', { index, format: audit?.ideas[index]?.format ?? null });
    try {
      await authFetch(`/api/audit/${id}/select`, { method: 'POST', body: JSON.stringify({ index }) });
    } catch {
      // Selection is resent with the campaign request.
    }
  };

  /** Save idea choice, then auth (if needed) → pricing. Checkout or explore continues into the product. */
  const continueToPlans = useCallback(
    async (indexOverride?: number) => {
      const index = indexOverride ?? selected;
      if (!id || index == null) {
        setActionError('Pick one of the three ideas first.');
        return;
      }
      setContinuing(true);
      setActionError(null);
      try {
        await authFetch(`/api/audit/${id}/select`, { method: 'POST', body: JSON.stringify({ index }) });
      } catch {
        /* selection is best-effort; attribution still carries the audit */
      }
      rememberAuditAttribution(id);
      const { data } = await supabase.auth.getSession();
      const pricing = auditPricingPath();
      if (!data.session) {
        router.push(`/auth/signup?next=${encodeURIComponent(pricing)}`);
        return;
      }
      router.push(pricing);
    },
    [id, selected, router]
  );

  useEffect(() => {
    if (!wantsContinue || continuedOnce.current || !id) return;
    continuedOnce.current = true;
    rememberAuditAttribution(id);
    if (authed) {
      router.replace(auditPricingPath());
      return;
    }
    router.replace(`/auth/signup?next=${encodeURIComponent(auditPricingPath())}`);
  }, [wantsContinue, authed, id, router]);

  const sourceIndex = useMemo(() => {
    const m = new Map<string, { n: number; src: SourceRef }>();
    audit?.sources.forEach((src, i) => m.set(src.id, { n: i + 1, src }));
    return m;
  }, [audit]);

  const EvidenceChips = ({ ids }: { ids: string[] }) =>
    ids.length ? (
      <span className="chips">
        {ids.map((sid) => {
          const s = sourceIndex.get(sid);
          if (!s) return null;
          return (
            <a key={sid} href={s.src.url} target="_blank" rel="noopener noreferrer nofollow" className="chip" title={s.src.title || s.src.url}>
              [{s.n}]
            </a>
          );
        })}
      </span>
    ) : null;

  const title = audit?.brand?.name ? `${audit.brand.name} marketing audit` : 'Your marketing audit';

  return (
    <div className="audit-page">
      <Head>
        <title>{`${title} | SkalX AI`}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <header className="topbar">
        <Link href="/" className="logo">SkalX AI</Link>
        {authed === false && (
          <Link href={`/auth/signin?next=${encodeURIComponent(`/audit/${id ?? ''}`)}`} className="toplink">
            Log in
          </Link>
        )}
      </header>

      <main className="wrap">
        {notFound && (
          <section className="card center">
            <h1 className="h1">Audit not found</h1>
            <p className="muted">This audit doesn&apos;t exist or belongs to another browser session.</p>
            <Link href="/" className="btn primary">Start a new audit</Link>
          </section>
        )}

        {!notFound && !audit && (
          <section className="card center" aria-busy="true">
            <ArcSpinner className="spin" size={22} />
            <p className="muted">{loadError || 'Loading your audit…'}</p>
          </section>
        )}

        {audit && isActive(audit) && (
          <section className="card progress" aria-live="polite">
            <p className="eyebrow">Free marketing audit</p>
            <h1 className="h1">Researching {audit.host}</h1>
            <p className="muted">This usually takes about a minute. You can refresh — progress is saved.</p>
            <ol className="stages">
              {AUDIT_STAGES.map((stage) => {
                const done = audit.progress.completed.includes(stage);
                const current = !done && AUDIT_STAGES.find((s) => !audit.progress.completed.includes(s)) === stage;
                return (
                  <li key={stage} className={done ? 'done' : current ? 'current' : ''}>
                    <span className="dot">{done ? <Check size={14} /> : current ? <ArcSpinner size={14} className="spin" /> : null}</span>
                    {STAGE_LABELS[stage]}
                  </li>
                );
              })}
            </ol>
            {loadError && <p className="warn">{loadError}</p>}
          </section>
        )}

        {audit?.status === 'failed' && (
          <section className="card center" role="alert">
            <AlertTriangle size={26} color={colors.destructive} />
            <h1 className="h1">We couldn&apos;t finish this audit</h1>
            <p className="muted">{audit.error?.message || 'Something went wrong during research.'}</p>
            <div className="row">
              {audit.canRetry && (
                <button type="button" className="btn primary" onClick={retry}>
                  <RefreshCw size={16} /> Try again
                </button>
              )}
              <Link href="/" className="btn ghost">Use a different URL</Link>
            </div>
            {!audit.canRetry && <p className="muted small">Retry limit reached for this audit.</p>}
          </section>
        )}

        {audit && hasResults && (
          <>
            <section className="intro">
              <p className="eyebrow">Free marketing audit · {audit.host}</p>
              <h1 className="h1 big">{audit.brand?.name || audit.host}</h1>
              {audit.insights?.summary && <p className="lead">{audit.insights.summary}</p>}
              {audit.status === 'partial' && (
                <p className="badge warnbadge"><Info size={14} /> Partial results — see limitations below</p>
              )}
            </section>

            <section className="grid2">
              <div className="card">
                <h2 className="h2">What your website says</h2>
                <p className="label observed">Observed</p>
                <dl className="facts">
                  {audit.brand?.facts.map((f, i) => (
                    <div key={i}>
                      <dt>{f.label}</dt>
                      <dd>
                        “{f.value}” <EvidenceChips ids={[f.sourceId]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="card">
                <h2 className="h2">How we read your brand</h2>
                <p className="label inferred">AI interpretation</p>
                <dl className="facts">
                  {(
                    [
                      ['Niche', audit.brand?.interpretation.niche],
                      ['Products', audit.brand?.interpretation.products.join(', ')],
                      ['Positioning', audit.brand?.interpretation.positioning],
                      ['Audience', audit.brand?.interpretation.audience],
                    ] as const
                  )
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
                {audit.brand?.basis === 'metadata_only' && (
                  <p className="muted small">Based on page metadata only.</p>
                )}
              </div>
            </section>

            <section className="card">
              <h2 className="h2">Competitors we found</h2>
              {audit.competitors.length ? (
                <ul className="list">
                  {audit.competitors.map((c) => (
                    <li key={c.id}>
                      <div>
                        <strong>{c.name}</strong>{' '}
                        <span className="muted">· {c.domain}</span>
                        {c.classification && (
                          <span className="pill" style={{ marginLeft: 8 }}>
                            {c.classification === 'direct' ? 'Direct' : 'Adjacent'}
                          </span>
                        )}
                        {c.overlapReason && (
                          <p className="muted small">
                            {c.overlapReason} <EvidenceChips ids={[c.sourceId]} />
                          </p>
                        )}
                        {!c.overlapReason && c.snippet && (
                          <p className="muted small">
                            {c.snippet} <EvidenceChips ids={[c.sourceId]} />
                          </p>
                        )}
                      </div>
                      <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="ext">
                        Visit <ExternalLink size={13} />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No competitors could be verified from public search results.</p>
              )}
              <p className="muted small">
                Ranked from public search evidence; weak keyword-only matches are filtered out.
              </p>
            </section>

            <section className="card">
              <h2 className="h2">Recent competitor activity</h2>
              <p className="label observed">Observed</p>
              {audit.competitorPosts.length ? (
                <ul className="posts">
                  {audit.competitorPosts.map((p) => (
                    <li key={p.id} className="post">
                      <div className="postmeta">
                        <strong>{p.competitorName}</strong>
                        <span className="pill">
                          {p.kind === 'ad'
                            ? p.platform === 'google_ads' || /adstransparency\.google\.com/i.test(p.url)
                              ? 'Google ad'
                              : 'Meta ad'
                            : p.platform === 'instagram'
                              ? 'Instagram'
                              : 'Facebook'}
                        </span>
                        <span className="muted small">
                          {p.kind === 'ad' && (formatDate(p.publishedAt) || (p.publishedLabel && p.publishedLabel !== 'Date unavailable'))
                            ? 'Running since '
                            : ''}
                          {formatDate(p.publishedAt) ||
                            p.publishedLabel ||
                            'Date unavailable'}
                        </span>
                      </div>
                      {p.text && <p className="posttext">{p.text}</p>}
                      <div className="postfoot">
                        {p.engagement ? (
                          <span className="small">
                            {[
                              p.engagement.likes != null && `${formatCount(p.engagement.likes)} likes`,
                              p.engagement.comments != null && `${formatCount(p.engagement.comments)} comments`,
                              p.engagement.views != null && `${formatCount(p.engagement.views)} views`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                            <span className="muted"> (as shown publicly)</span>
                          </span>
                        ) : (
                          <span className="muted small">Engagement not publicly available</span>
                        )}
                        <a href={p.url} target="_blank" rel="noopener noreferrer nofollow" className="ext">
                          View source <ExternalLink size={13} />
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">We couldn&apos;t find recent public posts from these competitors.</p>
              )}
            </section>

            {audit.insights && (audit.insights.themes.length > 0 || audit.insights.opportunities.length > 0) && (
              <section className="grid2">
                <div className="card">
                  <h2 className="h2">What competitors focus on</h2>
                  <p className="label inferred">AI interpretation of the evidence</p>
                  {audit.insights.themes.map((t, i) => (
                    <div key={i} className="insight">
                      <h3>{t.title}</h3>
                      <p>
                        {t.observation} <EvidenceChips ids={t.evidenceIds} />
                      </p>
                      {t.basis === 'inference' && <p className="muted small">No direct source — inference.</p>}
                    </div>
                  ))}
                </div>
                <div className="card">
                  <h2 className="h2">Opportunities in your niche</h2>
                  <p className="label inferred">AI interpretation</p>
                  {audit.insights.opportunities.map((o, i) => (
                    <div key={i} className="insight">
                      <h3>{o.title}</h3>
                      <p>
                        {o.explanation} <EvidenceChips ids={o.evidenceIds} />
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="ideas-head">
              <p className="eyebrow">What to create next</p>
              <h2 className="h1">3 ideas for {audit.brand?.name || 'your brand'}</h2>
              <p className="muted">Pick one and we&apos;ll set it up as a campaign in the studio.</p>
            </section>
            <section className="ideas" role="radiogroup" aria-label="Campaign ideas">
              {audit.ideas.map((idea, i) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === i}
                  key={i}
                  className={`idea ${selected === i ? 'sel' : ''}`}
                  onClick={() => chooseIdea(i)}
                >
                  <div className="idea-top">
                    <span className="pill">{idea.format}</span>
                    <span className={`radio ${selected === i ? 'on' : ''}`}>{selected === i && <Check size={12} />}</span>
                  </div>
                  <h3>{idea.title}</h3>
                  <p className="hook">“{idea.hook}”</p>
                  <p className="small">{idea.brief}</p>
                  <dl className="ideameta">
                    <div><dt>Audience</dt><dd>{idea.audience}</dd></div>
                    <div><dt>Why</dt><dd>{idea.rationale} <EvidenceChips ids={idea.evidenceIds} /></dd></div>
                    <div><dt>CTA</dt><dd>{idea.cta}</dd></div>
                  </dl>
                </button>
              ))}
            </section>

            <section className="cta">
              <button
                type="button"
                className="btn primary lg"
                disabled={selected == null || continuing}
                onClick={() => continueToPlans()}
              >
                {continuing ? <ArcSpinner size={16} className="spin" /> : <Sparkles size={16} />}
                {continuing
                  ? 'Continuing…'
                  : authed
                    ? 'See plans to create this'
                    : 'Create a free account to continue'}
                {!continuing && <ArrowRight size={16} />}
              </button>
              <p className="muted small">
                {authed
                  ? 'Your audit is saved. Next: choose a plan to create this, or explore SkalX first.'
                  : 'Create a free account, then choose a plan or explore SkalX. No card required.'}
              </p>
              {actionError && <p className="warn" role="alert">{actionError}</p>}
            </section>

            {audit.limitations.length > 0 && (
              <section className="card">
                <h2 className="h2">Limitations of this audit</h2>
                <ul className="limits">
                  {audit.limitations.map((l) => (
                    <li key={l.code}><Info size={14} /> {l.message}</li>
                  ))}
                </ul>
              </section>
            )}

            <section className="card">
              <h2 className="h2">Sources</h2>
              <ol className="sources">
                {audit.sources.map((s) => (
                  <li key={s.id}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">{s.title || s.url}</a>
                    <span className="muted small">
                      {' '}
                      · {s.publishedAt ? `Published ${formatDate(s.publishedAt)}` : 'Publish date not shown'} · Retrieved{' '}
                      {formatDate(s.retrievedAt)}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}
      </main>

      <style jsx>{`
        .audit-page {
          min-height: 100vh;
          background: ${colors.background};
          color: ${colors.foreground};
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px clamp(16px, 4vw, 40px);
          border-bottom: 1px solid ${colors.border};
        }
        .topbar :global(.logo) {
          font-weight: 600;
          letter-spacing: -0.01em;
          color: ${colors.foreground};
        }
        .topbar :global(.toplink) {
          font-size: 14px;
          color: ${colors.mutedForeground};
        }
        .wrap {
          max-width: 1040px;
          margin: 0 auto;
          padding: 32px clamp(16px, 4vw, 32px) 80px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .card {
          background: hsl(0 0% 11%);
          border: 1px solid ${colors.border};
          border-radius: 16px;
          padding: clamp(18px, 3vw, 26px);
        }
        .center {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          padding: 48px 24px;
        }
        .eyebrow {
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${colors.mutedForeground};
          margin: 0 0 8px;
        }
        .h1 {
          font-size: clamp(22px, 3vw, 28px);
          font-weight: 500;
          letter-spacing: -0.01em;
          margin: 0;
        }
        .big {
          font-size: clamp(28px, 4.5vw, 40px);
        }
        .h2 {
          font-size: 17px;
          font-weight: 600;
          margin: 0 0 6px;
        }
        .lead {
          font-size: 17px;
          font-weight: 300;
          color: hsl(0 0% 80%);
          max-width: 760px;
          margin: 12px 0 0;
          line-height: 1.55;
        }
        .muted {
          color: ${colors.mutedForeground};
          margin: 0;
        }
        .small {
          font-size: 13px;
          line-height: 1.5;
        }
        .warn {
          color: ${colors.destructive};
          font-size: 14px;
          margin: 8px 0 0;
        }
        .row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 8px;
        }
        .label {
          display: inline-block;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 3px 8px;
          border-radius: 999px;
          margin: 0 0 14px;
        }
        .observed {
          background: hsl(152 60% 40% / 0.14);
          color: hsl(152 60% 62%);
        }
        .inferred {
          background: hsl(213 100% 55% / 0.14);
          color: ${colors.accentForeground};
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          margin: 14px 0 0;
          padding: 6px 10px;
          border-radius: 999px;
        }
        .warnbadge {
          background: hsl(38 92% 50% / 0.12);
          color: hsl(38 92% 65%);
        }
        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .facts {
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .facts dt,
        .ideameta dt {
          font-size: 12px;
          color: ${colors.mutedForeground};
          margin-bottom: 2px;
        }
        .facts dd,
        .ideameta dd {
          margin: 0;
          font-size: 14px;
          line-height: 1.5;
        }
        .list,
        .posts,
        .limits,
        .sources {
          list-style: none;
          margin: 8px 0 12px;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .list li {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
          padding-bottom: 12px;
          border-bottom: 1px solid ${colors.border};
        }
        .list li:last-child {
          border-bottom: none;
        }
        .post {
          border: 1px solid ${colors.border};
          border-radius: 12px;
          padding: 14px;
        }
        .postmeta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
        .posttext {
          font-size: 14px;
          line-height: 1.5;
          color: hsl(0 0% 82%);
          margin: 8px 0;
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .postfoot {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
        }
        .pill {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 999px;
          background: ${colors.muted};
          color: hsl(0 0% 85%);
        }
        .ext,
        :global(.chip) {
          color: ${colors.accentForeground};
        }
        .ext {
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        .chips {
          display: inline-flex;
          gap: 4px;
        }
        :global(.chip) {
          font-size: 12px;
        }
        .insight + .insight {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px solid ${colors.border};
        }
        .insight h3 {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 4px;
        }
        .insight p {
          font-size: 14px;
          line-height: 1.55;
          margin: 0;
          color: hsl(0 0% 82%);
        }
        .ideas-head {
          margin-top: 16px;
        }
        .ideas-head .muted {
          margin-top: 6px;
        }
        .ideas {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .idea {
          text-align: left;
          background: hsl(0 0% 11%);
          border: 1px solid ${colors.border};
          border-radius: 16px;
          padding: 18px;
          color: inherit;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .idea:hover {
          border-color: hsl(0 0% 32%);
        }
        .idea.sel {
          border-color: ${colors.primary};
          box-shadow: 0 0 0 1px ${colors.primary}, ${colors.shadowGlow};
        }
        .idea:focus-visible {
          outline: 2px solid ${colors.ring};
          outline-offset: 2px;
        }
        .idea-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .radio {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1px solid hsl(0 0% 40%);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .radio.on {
          background: ${colors.primary};
          border-color: ${colors.primary};
        }
        .idea h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }
        .hook {
          font-size: 14px;
          font-style: italic;
          color: hsl(0 0% 85%);
          margin: 0;
        }
        .idea .small {
          margin: 0;
          color: hsl(0 0% 75%);
        }
        .ideameta {
          margin: 4px 0 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid ${colors.border};
          padding-top: 10px;
        }
        .cta {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin: 8px 0 12px;
        }
        :global(.btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 44px;
          padding: 0 20px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          border: 1px solid transparent;
          cursor: pointer;
        }
        :global(.btn.primary) {
          background: ${colors.gradientPrimary};
          color: ${colors.primaryForeground};
          box-shadow: ${colors.shadowGlow};
        }
        :global(.btn.ghost) {
          background: transparent;
          border-color: ${colors.border};
          color: ${colors.foreground};
        }
        :global(.btn.lg) {
          height: 52px;
          padding: 0 28px;
        }
        :global(.btn:disabled) {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .limits li {
          display: flex;
          gap: 8px;
          font-size: 14px;
          color: hsl(0 0% 78%);
          line-height: 1.5;
        }
        .limits :global(svg) {
          flex: none;
          margin-top: 3px;
        }
        .sources {
          list-style: decimal;
          padding-left: 22px;
          gap: 8px;
        }
        .sources a {
          color: ${colors.accentForeground};
          font-size: 14px;
          word-break: break-word;
        }
        .progress {
          max-width: 560px;
          margin: 40px auto 0;
          width: 100%;
        }
        .progress .muted {
          margin-top: 8px;
        }
        .stages {
          list-style: none;
          padding: 0;
          margin: 24px 0 0;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .stages li {
          display: flex;
          align-items: center;
          gap: 12px;
          color: ${colors.mutedForeground};
          font-size: 15px;
        }
        .stages li.done,
        .stages li.current {
          color: ${colors.foreground};
        }
        .dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid ${colors.border};
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: none;
        }
        .stages li.done .dot {
          background: hsl(152 60% 40% / 0.2);
          border-color: hsl(152 60% 45%);
          color: hsl(152 60% 62%);
        }
        .stages li.current .dot {
          border-color: ${colors.primary};
          color: ${colors.primary};
        }
        :global(.spin) {
          animation: auditspin 0.9s linear infinite;
        }
        @keyframes auditspin {
          to {
            transform: rotate(360deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          :global(.spin) {
            animation: none;
          }
        }
        @media (max-width: 860px) {
          .grid2,
          .ideas {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
