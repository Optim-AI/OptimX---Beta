/** Monday brief email (HTML + text). All user-derived strings are escaped. */
import type { BriefContent } from './content';

export function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const d = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function renderBriefEmail(c: BriefContent, links: { dashboard: string; pack: string | null; settings: string }, brandName: string | null) {
  const week = `${d(c.weekStart)} – ${d(c.weekEnd)}`;
  const subject = `${brandName ? `${brandName}: ` : ''}your Monday ad brief (${week})`;
  const section = (title: string, body: string) =>
    `<tr><td style="padding:16px 0 4px;font:600 13px/1.4 Arial,sans-serif;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">${esc(title)}</td></tr><tr><td style="font:15px/1.5 Arial,sans-serif;color:#111827">${body}</td></tr>`;
  const list = (items: { name: string; line: string }[], empty: string) =>
    items.length ? items.map((i) => `<p style="margin:0 0 8px"><strong>${esc(i.name)}</strong><br><span style="color:#374151">${esc(i.line)}</span></p>`).join('') : `<p style="margin:0;color:#6b7280">${esc(empty)}</p>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td style="font:700 20px/1.3 Arial,sans-serif;color:#111827">Your Monday brief</td></tr>
<tr><td style="padding-top:4px;font:13px Arial,sans-serif;color:#6b7280">Last week, ${esc(week)}</td></tr>
<tr><td style="padding-top:16px;font:600 16px/1.5 Arial,sans-serif;color:#111827">${esc(c.oneLine)}</td></tr>
${c.notEnoughData ? `<tr><td style="padding-top:8px;font:13px/1.5 Arial,sans-serif;color:#92400e">Spend was low, so treat these as early signals.</td></tr>` : ''}
${section('What won', list(c.winners, 'No clear winner yet.'))}
${section('What to stop', list(c.stop, 'Nothing to stop this week.') + (c.stop.length ? '<p style="margin:4px 0 0;font-size:13px;color:#6b7280">Pause these in Meta Ads Manager.</p>' : ''))}
${c.topPost ? section('Top post', `<p style="margin:0">${esc(c.topPost.caption ?? '(no caption)')}</p><p style="margin:4px 0 0;color:#374151">${esc(c.topPost.line)}${c.topPost.permalink ? ` · <a href="${esc(c.topPost.permalink)}" style="color:#2563eb">View</a>` : ''}</p>`) : ''}
${links.pack && c.pack ? `<tr><td style="padding-top:20px"><a href="${esc(links.pack)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font:600 15px Arial,sans-serif;padding:12px 20px;border-radius:8px">See ${c.pack.ads} new ads to test</a></td></tr>` : ''}
${c.packNote ? `<tr><td style="padding-top:12px;font:13px/1.5 Arial,sans-serif;color:#6b7280">${esc(c.packNote)}</td></tr>` : ''}
<tr><td style="padding-top:20px;font:14px Arial,sans-serif"><a href="${esc(links.dashboard)}" style="color:#2563eb">Open Ad Performance</a></td></tr>
<tr><td style="padding-top:24px;font:12px/1.5 Arial,sans-serif;color:#9ca3af">You get this because Meta is connected to SkalX AI. <a href="${esc(links.settings)}" style="color:#9ca3af">Turn off the Monday email</a>.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Your Monday brief — last week, ${week}`,
    '',
    c.oneLine,
    c.notEnoughData ? 'Spend was low, so treat these as early signals.' : '',
    '',
    'WHAT WON',
    ...(c.winners.length ? c.winners.map((w) => `- ${w.name}: ${w.line}`) : ['- No clear winner yet.']),
    '',
    'WHAT TO STOP',
    ...(c.stop.length ? c.stop.map((s) => `- ${s.name}: ${s.line}`) : ['- Nothing to stop this week.']),
    ...(c.topPost ? ['', 'TOP POST', `- ${c.topPost.caption ?? '(no caption)'} — ${c.topPost.line}${c.topPost.permalink ? ` ${c.topPost.permalink}` : ''}`] : []),
    ...(links.pack && c.pack ? ['', `${c.pack.ads} new ads to test: ${links.pack}`] : []),
    ...(c.packNote ? ['', c.packNote] : []),
    '',
    `Open Ad Performance: ${links.dashboard}`,
    `Turn off the Monday email: ${links.settings}`,
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  return { subject, html, text };
}
