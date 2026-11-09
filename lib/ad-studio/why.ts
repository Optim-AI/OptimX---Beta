/** "Why we suggested it" for a draft poster, from the researched angle (no hooks shown). */
export type DraftAngle = {
  angle: string;
  title: string;
  message: string;
  insight: string;
  evidence: string;
  basis: 'site' | 'web' | 'inferred' | string;
  audience: string;
  funnel: string;
  proof: string;
  why_it_wins: string;
  test: string;
};

export type DraftWhy = { forWho: string; whyItMightWork: string; whatItTests: string; source: string; evidence: string | null };

const SOURCE: Record<string, string> = {
  site: 'From your website',
  web: 'From research on the web',
  inferred: 'SkalX’s reasoning',
};

export function draftWhy(a: Partial<DraftAngle>): DraftWhy {
  return {
    forWho: a.audience || 'Your usual buyers',
    whyItMightWork: a.why_it_wins || a.insight || a.message || '',
    whatItTests: a.test || (a.angle ? `Whether "${a.angle}" gets people to buy` : ''),
    source: SOURCE[a.basis ?? ''] ?? 'SkalX’s reasoning',
    evidence: a.evidence || null,
  };
}

/** Keep only what the engine and the UI need from a StrategyAngle. */
export function toDraftAngle(a: Record<string, unknown>): DraftAngle {
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  return {
    angle: s(a.angle, 60), title: s(a.title, 120), message: s(a.message, 300), insight: s(a.insight, 300),
    evidence: s(a.evidence, 300), basis: s(a.basis, 20) || 'inferred', audience: s(a.audience, 160), funnel: s(a.funnel, 20),
    proof: s(a.proof, 240), why_it_wins: s(a.why_it_wins, 240), test: s(a.test, 240),
  };
}
