// Display formatting for the Meta Intelligence dashboard.
export const SERIES = { spend: '#3987e5', revenue: '#d95926' } as const; // validated on the dark card surface
export const GOOD = 'hsl(142 70% 50%)';
export const BAD = 'hsl(0 84% 62%)';

const locale = 'en-IN';

export function money(v: number | null | undefined, currency: string | null, opts: { compact?: boolean } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency: currency || 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: opts.compact || Math.abs(v) >= 1000 ? 0 : 2,
      notation: opts.compact ? 'compact' : 'standard',
    }).format(v);
  } catch {
    return v.toFixed(0);
  }
}

export function count(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0, notation: opts.compact ? 'compact' : 'standard' }).format(v);
}

export function ratio(v: number | null | undefined, suffix = '×'): string {
  return v === null || v === undefined ? '—' : `${v.toFixed(2)}${suffix}`;
}

export function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${v.toFixed(2)}%`;
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function deliveryBadge(status: string | null): { label: string; tone: 'good' | 'muted' | 'warn' } {
  const s = (status || '').toUpperCase();
  if (s === 'ACTIVE') return { label: 'Running', tone: 'good' };
  if (s.includes('PAUSED')) return { label: 'Paused', tone: 'muted' };
  if (s === 'ARCHIVED' || s === 'DELETED') return { label: 'Ended', tone: 'muted' };
  if (s === 'IN_PROCESS' || s === 'PENDING_REVIEW' || s === 'PREAPPROVED') return { label: 'In review', tone: 'muted' };
  if (s) return { label: 'Needs attention', tone: 'warn' };
  return { label: 'Unknown', tone: 'muted' };
}
