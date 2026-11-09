// Edit a draft: describe the change, optionally drag a box to change only that area. Edits are free drafts.
import React, { useRef, useState } from 'react';
import { Loader2, X, SquareDashedMousePointer } from 'lucide-react';
import colors from '@/lib/ui/colors';

type Box = { x: number; y: number; w: number; h: number };

export default function EditDialog({ imageUrl, aspect, onClose, onSubmit }: {
  imageUrl: string; aspect: string; onClose: () => void; onSubmit: (instruction: string, box: Box | null) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [boxMode, setBoxMode] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ratio = aspect === '1.91:1' ? '1.91 / 1' : aspect.replace(':', ' / ');

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };

  async function send() {
    setSending(true);
    try {
      await onSubmit(text.trim(), boxMode && box && box.w > 0.03 && box.h > 0.03 ? box : null);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Edit poster">
      <div className="flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>Change this poster</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5" style={{ color: colors.mutedForeground }}><X size={18} /></button>
        </div>
        <div ref={ref} className="relative mx-auto w-full max-w-xs touch-none select-none overflow-hidden rounded-xl" style={{ aspectRatio: ratio, cursor: boxMode ? 'crosshair' : 'default' }}
          onPointerDown={(e) => { if (!boxMode) return; const p = point(e); setDrag(p); setBox({ x: p.x, y: p.y, w: 0, h: 0 }); (e.target as Element).setPointerCapture?.(e.pointerId); }}
          onPointerMove={(e) => { if (!boxMode || !drag) return; const p = point(e); setBox({ x: Math.min(p.x, drag.x), y: Math.min(p.y, drag.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) }); }}
          onPointerUp={() => setDrag(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Poster to edit" className="h-full w-full object-cover" draggable={false} />
          {boxMode && box && box.w > 0 ? (
            <span className="absolute border-2 border-dashed" style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, borderColor: '#facc15', background: 'rgba(250,204,21,0.15)' }} />
          ) : null}
        </div>
        <button type="button" onClick={() => { setBoxMode((m) => !m); setBox(null); }} className="inline-flex items-center gap-1.5 self-start rounded-lg px-3 py-1.5 text-xs font-medium"
          style={{ background: boxMode ? colors.accent : colors.secondary, border: `1px solid ${boxMode ? colors.primary : colors.border}`, color: colors.foreground }} aria-pressed={boxMode}>
          <SquareDashedMousePointer size={13} /> {boxMode ? 'Drag on the poster to mark the area (tap again to edit the whole poster)' : 'Only change one area (optional)'}
        </button>
        <label className="block">
          <span className="text-sm font-medium" style={{ color: colors.foreground }}>What should change?</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} autoFocus
            placeholder={boxMode ? 'e.g. Make this text say “Diwali special”' : 'e.g. Make the product bigger and the background warmer'}
            className="mt-1 w-full rounded-lg px-3 py-2.5 text-sm" style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }} />
        </label>
        <p className="text-xs" style={{ color: colors.mutedForeground }}>The edited poster appears next to the original as a new draft. Free — you only pay if you keep it.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-lg px-4 text-sm" style={{ color: colors.mutedForeground }}>Cancel</button>
          <button type="button" onClick={send} disabled={sending || text.trim().length < 3 || (boxMode && !(box && box.w > 0.03 && box.h > 0.03))}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-semibold disabled:opacity-50" style={{ background: colors.primary, color: colors.primaryForeground }}>
            {sending ? <Loader2 size={14} className="animate-spin" /> : null} Make the change
          </button>
        </div>
      </div>
    </div>
  );
}
