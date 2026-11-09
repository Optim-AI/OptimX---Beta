// "How it would look" mock-ups: a feed post and a full-screen story, styled neutrally (no platform logos).
import React, { useState } from 'react';
import { X, Heart, MessageCircle, Send, Bookmark, ThumbsUp, Share2, MoreHorizontal } from 'lucide-react';

type Mode = 'ig_feed' | 'ig_story' | 'fb_feed';
const TABS: { id: Mode; label: string }[] = [
  { id: 'ig_feed', label: 'Instagram feed' },
  { id: 'ig_story', label: 'Instagram story' },
  { id: 'fb_feed', label: 'Facebook feed' },
];

function Avatar({ src, name }: { src: string | null; name: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-8 w-8 rounded-full object-cover" />
  ) : (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-300 text-xs font-bold text-neutral-700">{name.slice(0, 1)}</span>
  );
}

export default function FeedPreview({ imageUrl, aspect, brandName, avatarUrl, caption, onClose, note = 'A mock-up to judge the look. Drafts show the preview watermark until you keep them.' }: {
  imageUrl: string; aspect: string; brandName: string; avatarUrl: string | null; caption: string; onClose: () => void; note?: string;
}) {
  const [mode, setMode] = useState<Mode>(aspect === '9:16' ? 'ig_story' : 'ig_feed');
  const ratio = aspect === '1.91:1' ? '1.91 / 1' : aspect.replace(':', ' / ');
  const [rw, rh] = aspect === '1.91:1' ? [1.91, 1] : aspect.split(':').map(Number);
  // Fit the whole post (header + image + buttons + caption ≈ 230px of chrome) inside the window.
  const feedWidth = `min(100%, 448px, calc((100vh - 290px) * ${(rw / rh).toFixed(3)}))`;
  // Facebook puts the caption above the image and a reactions row below: a little more chrome.
  const fbWidth = `min(100%, 448px, calc((100vh - 360px) * ${(rw / rh).toFixed(3)}))`;
  const handle = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourbrand';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Preview in feed" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-md flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-lg bg-white/10 p-1" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={mode === t.id} onClick={() => setMode(t.id)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${mode === t.id ? 'bg-white text-black' : 'text-white/80'}`}>{t.label}</button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-full p-2 text-white/80 hover:bg-white/10"><X size={18} /></button>
        </div>

        {mode === 'ig_story' ? (
          <div className="relative mx-auto overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '9 / 16', width: 'min(100%, 300px, calc((100vh - 140px) * 0.5625))' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Poster preview" className="absolute inset-0 h-full w-full object-contain" />
            <div className="absolute inset-x-0 top-0 p-3">
              <div className="mb-2 h-0.5 rounded bg-white/40"><div className="h-full w-1/3 rounded bg-white" /></div>
              <div className="flex items-center gap-2 text-xs font-semibold text-white drop-shadow"><Avatar src={avatarUrl} name={brandName} /> {handle} <span className="font-normal text-white/80">Sponsored</span></div>
            </div>
            <div className="absolute inset-x-0 bottom-0 p-4 text-center">
              <span className="inline-block rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black">Shop now</span>
            </div>
          </div>
        ) : mode === 'ig_feed' ? (
          <div className="mx-auto overflow-y-auto rounded-xl bg-white text-black" style={{ width: feedWidth }}>
            <div className="flex items-center gap-2 p-3 text-sm"><Avatar src={avatarUrl} name={brandName} /><span className="truncate font-semibold">{handle}</span><span className="shrink-0 text-xs text-neutral-500">Sponsored</span><MoreHorizontal size={16} className="ml-auto" /></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Poster preview" className="w-full object-cover" style={{ aspectRatio: ratio }} />
            <div className="flex items-center justify-between bg-neutral-100 px-3 py-2 text-sm font-semibold"><span>Shop now</span><span>›</span></div>
            <div className="flex gap-4 px-3 pt-3"><Heart size={22} /><MessageCircle size={22} /><Send size={22} /><Bookmark size={22} className="ml-auto" /></div>
            <p className="px-3 pb-4 pt-2 text-sm"><span className="font-semibold">{handle}</span> {caption}</p>
          </div>
        ) : (
          <div className="mx-auto overflow-y-auto rounded-xl bg-white text-black" style={{ width: fbWidth }}>
            <div className="flex items-center gap-2 p-3"><Avatar src={avatarUrl} name={brandName} /><div><p className="text-sm font-semibold">{brandName}</p><p className="text-xs text-neutral-500">Sponsored</p></div><MoreHorizontal size={16} className="ml-auto" /></div>
            <p className="px-3 pb-3 text-sm">{caption}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Poster preview" className="w-full object-cover" style={{ aspectRatio: ratio }} />
            <div className="flex items-center justify-between bg-neutral-100 px-3 py-2.5"><div className="text-xs text-neutral-500">{handle.toUpperCase()}</div><span className="rounded bg-neutral-200 px-3 py-1.5 text-sm font-semibold">Shop now</span></div>
            <div className="flex justify-around border-t py-2 text-sm text-neutral-600"><span className="flex items-center gap-1"><ThumbsUp size={16} /> Like</span><span className="flex items-center gap-1"><MessageCircle size={16} /> Comment</span><span className="flex items-center gap-1"><Share2 size={16} /> Share</span></div>
          </div>
        )}
        <p className="text-center text-xs text-white/70">{note}</p>
      </div>
    </div>
  );
}
