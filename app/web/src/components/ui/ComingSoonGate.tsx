// "Coming soon" card shown over a page that is built but not open yet (same look as UGC Studio's).
// The page behind is blurred and can't be used.
import React from 'react';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import colors from '@/lib/ui/colors';

export default function ComingSoonGate({ Icon, title, body, onBack, backLabel = 'Back to Brand Studio' }: {
  Icon: LucideIcon; title: string; body: string; onBack: () => void; backLabel?: string;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6" style={{ background: 'rgba(11, 11, 15, 0.55)' }}>
      <div role="dialog" aria-labelledby="coming-soon-title" className="w-full max-w-md rounded-2xl p-7 text-center"
        style={{ background: '#16161C', border: `1px solid ${colors.border}`, boxShadow: '0 24px 60px rgba(0,0,0,0.45)' }}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(245, 185, 66, 0.14)', color: '#f5b942' }}>
          <Icon size={22} aria-hidden />
        </div>
        <span className="mt-5 inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#f5b942', background: 'rgba(245, 185, 66, 0.14)' }}>
          Coming soon
        </span>
        <h2 id="coming-soon-title" className="mt-3 text-xl font-semibold" style={{ color: colors.foreground }}>{title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: colors.mutedForeground }}>{body}</p>
        <button type="button" onClick={onBack} className="mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-white" style={{ background: colors.primary }}>
          {backLabel} <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
