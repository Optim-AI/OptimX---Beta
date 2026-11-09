// "Tell SkalX what you want": chat → a direction → "Make posters with this" (a new free round).
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, MessageSquareText, Send, Sparkles, X } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';

type Msg = { role: 'user' | 'assistant'; content: string };

const STARTERS = ['Show it with rice and rasam', 'Make it feel festive', 'Less text, bigger product', 'For bachelors who don’t cook'];

export default function ChatPanel({ projectId, roundSize, canMakeMore, onMakeRound, onClose }: {
  projectId: string; roundSize: number; canMakeMore: boolean; onMakeRound: (direction: string) => Promise<void>; onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: 'Tell me how you’d like the posters to look or who they’re for. I’ll turn it into a brief and SkalX will research and draw new ones.' }]);
  const [input, setInput] = useState('');
  const [direction, setDirection] = useState('');
  const [thinking, setThinking] = useState(false);
  const [making, setMaking] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || thinking) return;
    const next: Msg[] = [...messages, { role: 'user', content: t }];
    setMessages(next);
    setInput('');
    setThinking(true);
    try {
      const res = await authFetch(`/api/ad-studio/projects/${projectId}/chat`, { method: 'POST', body: JSON.stringify({ messages: next.slice(1) }) });
      const body = (await res.json().catch(() => ({}))) as { reply?: string; direction?: string; message?: string };
      if (!res.ok || !body.reply) throw new Error(body.message || 'SkalX couldn’t reply just now. Try again.');
      setMessages((m) => [...m, { role: 'assistant', content: body.reply! }]);
      if (body.direction) setDirection(body.direction);
    } catch (e) {
      showError((e as Error).message);
      setMessages((m) => m.slice(0, -1));
      setInput(t);
    } finally {
      setThinking(false);
    }
  }

  async function make() {
    setMaking(true);
    try {
      await onMakeRound(direction);
      onClose();
    } finally {
      setMaking(false);
    }
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l shadow-2xl" style={{ background: colors.card, borderColor: colors.border }} aria-label="Tell SkalX what you want">
      <header className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: colors.border }}>
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: colors.foreground }}><MessageSquareText size={16} /> Tell SkalX what you want</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5" style={{ color: colors.mutedForeground }}><X size={18} /></button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto' : ''}`}
            style={m.role === 'user' ? { background: colors.primary, color: colors.primaryForeground } : { background: colors.secondary, color: colors.foreground }}>{m.content}</div>
        ))}
        {thinking ? <div className="flex items-center gap-2 text-xs" style={{ color: colors.mutedForeground }}><Loader2 size={13} className="animate-spin" /> Thinking…</div> : null}
        {messages.length === 1 ? (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => <button key={s} type="button" onClick={() => void send(s)} className="rounded-full px-3 py-1.5 text-xs" style={{ background: colors.muted, color: colors.foreground }}>{s}</button>)}
          </div>
        ) : null}
        <div ref={end} />
      </div>
      {direction ? (
        <div className="border-t px-4 py-3" style={{ borderColor: colors.border }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>Brief for the next posters</p>
          <p className="mt-1 text-xs" style={{ color: colors.secondaryForeground }}>{direction}</p>
          <button type="button" onClick={make} disabled={making || !canMakeMore} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: colors.primary, color: colors.primaryForeground }}>
            {making ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {canMakeMore ? `Make ${roundSize} posters with this` : 'No free drafts left today'}
          </button>
        </div>
      ) : null}
      <form className="flex gap-2 border-t p-3" style={{ borderColor: colors.border }} onSubmit={(e) => { e.preventDefault(); void send(input); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Type what you want…" aria-label="Message"
          className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }} />
        <button type="submit" disabled={thinking || !input.trim()} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-lg disabled:opacity-50" style={{ background: colors.primary, color: colors.primaryForeground }}><Send size={16} /></button>
      </form>
    </aside>
  );
}
