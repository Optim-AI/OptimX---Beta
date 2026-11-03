'use client';

/**
 * Full-screen viewer for generated creatives: step through every creative,
 * swipe carousel slides, and preview each one as an Instagram or Facebook feed ad.
 * Mockups never invent engagement numbers (no fake likes or comments).
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  ThumbsUp,
  X,
} from 'lucide-react';

export type ViewerItem = {
  id: string;
  /** One image for a poster; several for a carousel. */
  images: string[];
  videoUrl?: string | null;
  title?: string;
  /** Feed caption (ad primary text). */
  caption?: string;
  /** Headline under the media in the Facebook link bar. */
  headline?: string;
  ctaLabel?: string;
};

export type ViewerBrand = { name: string; logo?: string | null; website?: string | null };

type Mode = 'full' | 'instagram' | 'facebook';

type Props = {
  items: ViewerItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  brand: ViewerBrand;
  initialSlide?: number;
  initialMode?: 'full' | 'instagram' | 'facebook';
  /** Per-item action buttons (download, edit…) */
  renderActions?: (item: ViewerItem, index: number, slide: number) => React.ReactNode;
};

function handleFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._]/g, '') || 'yourbrand';
}

function domainFor(website?: string | null): string {
  try {
    return website ? new URL(website).hostname.replace(/^www\./, '').toUpperCase() : '';
  } catch {
    return '';
  }
}

function Avatar({ brand, size }: { brand: ViewerBrand; size: number }) {
  return brand.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={brand.logo} alt="" className="rounded-full object-contain bg-white" style={{ width: size, height: size }} />
  ) : (
    <div
      className="rounded-full bg-neutral-800 text-white flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {brand.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Media({
  item,
  slide,
  onSlide,
  aspect,
}: {
  item: ViewerItem;
  slide: number;
  onSlide: (n: number) => void;
  aspect: string;
}) {
  const many = item.images.length > 1;
  return (
    <div className={`relative w-full bg-neutral-900 ${aspect}`}>
      {item.videoUrl ? (
        <video src={item.videoUrl} controls playsInline className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.images[slide]} alt={item.title || 'Creative'} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {many && (
        <>
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
            {slide + 1}/{item.images.length}
          </span>
          {slide > 0 && (
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => onSlide(slide - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 text-neutral-900 shadow"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {slide < item.images.length - 1 && (
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => onSlide(slide + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/85 p-1 text-neutral-900 shadow"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Dots({ count, active }: { count: number; active: number }) {
  if (count < 2) return null;
  return (
    <div className="flex justify-center gap-1">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: i === active ? '#0095f6' : '#c7c7c7' }} />
      ))}
    </div>
  );
}

function InstagramPost({ item, brand, slide, onSlide }: { item: ViewerItem; brand: ViewerBrand; slide: number; onSlide: (n: number) => void }) {
  const handle = handleFor(brand.name);
  return (
    <div
      className="max-w-full overflow-hidden rounded-xl bg-white text-[13px] text-neutral-900 shadow-2xl"
      style={{ width: 'min(380px, calc((100vh - 330px) * 0.8))', minWidth: 260 }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Avatar brand={brand} size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{handle}</p>
          <p className="text-[11px] text-neutral-500">Sponsored</p>
        </div>
        <MoreHorizontal className="h-5 w-5" />
      </div>
      <Media item={item} slide={slide} onSlide={onSlide} aspect="aspect-[4/5]" />
      <div className="flex items-center justify-between bg-[#0095f6]/10 px-3 py-2 text-[13px] font-semibold text-[#0095f6]">
        {item.ctaLabel || 'Shop now'} <ChevronRight className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-4 px-3 pt-2.5">
        <Heart className="h-6 w-6" />
        <MessageCircle className="h-6 w-6" />
        <Send className="h-6 w-6" />
        <div className="flex-1">
          <Dots count={item.images.length} active={slide} />
        </div>
        <Bookmark className="h-6 w-6" />
      </div>
      {item.caption && (
        <p className="px-3 pb-3 pt-2 leading-snug">
          <span className="font-semibold">{handle}</span> {item.caption}
        </p>
      )}
    </div>
  );
}

function FacebookPost({ item, brand, slide, onSlide }: { item: ViewerItem; brand: ViewerBrand; slide: number; onSlide: (n: number) => void }) {
  const domain = domainFor(brand.website);
  return (
    <div
      className="max-w-full overflow-hidden rounded-xl bg-white text-[14px] text-[#050505] shadow-2xl"
      style={{ width: 'min(420px, calc((100vh - 380px) * 0.8))', minWidth: 280 }}
    >
      <div className="flex items-center gap-2 px-3 py-3">
        <Avatar brand={brand} size={40} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-semibold">{brand.name}</p>
          <p className="flex items-center gap-1 text-[12px] text-[#65676b]">
            Sponsored · <Globe2 className="h-3 w-3" />
          </p>
        </div>
        <MoreHorizontal className="h-5 w-5 text-[#65676b]" />
      </div>
      {item.caption && <p className="px-3 pb-3 leading-snug">{item.caption}</p>}
      <Media item={item} slide={slide} onSlide={onSlide} aspect="aspect-[4/5]" />
      <div className="flex items-center gap-3 bg-[#f0f2f5] px-3 py-2.5">
        <div className="min-w-0 flex-1">
          {domain && <p className="truncate text-[12px] text-[#65676b]">{domain}</p>}
          <p className="truncate text-[15px] font-semibold">{item.headline || item.title || brand.name}</p>
        </div>
        <span className="shrink-0 rounded-md bg-[#e4e6eb] px-3 py-1.5 text-[14px] font-semibold">{item.ctaLabel || 'Shop now'}</span>
      </div>
      {item.images.length > 1 && (
        <div className="py-2">
          <Dots count={item.images.length} active={slide} />
        </div>
      )}
      <div className="mx-3 flex justify-around border-t border-[#ced0d4] py-1.5 text-[14px] font-semibold text-[#65676b]">
        <span className="flex items-center gap-1.5 py-1"><ThumbsUp className="h-4 w-4" /> Like</span>
        <span className="flex items-center gap-1.5 py-1"><MessageCircle className="h-4 w-4" /> Comment</span>
        <span className="flex items-center gap-1.5 py-1"><Share2 className="h-4 w-4" /> Share</span>
      </div>
    </div>
  );
}

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'full', label: 'Full size' },
  { id: 'instagram', label: 'Instagram feed' },
  { id: 'facebook', label: 'Facebook feed' },
];

export default function CreativeViewer({
  items,
  index,
  onIndexChange,
  onClose,
  brand,
  initialSlide = 0,
  initialMode = 'full',
  renderActions,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [slide, setSlide] = useState(initialSlide);
  const item = items[index];
  const slideCount = item?.images.length || 1;

  const go = useCallback(
    (dir: 1 | -1) => {
      // Within a carousel first, then on to the next/previous creative.
      const next = slide + dir;
      if (next >= 0 && next < slideCount) return setSlide(next);
      if (items.length < 2) return;
      const target = (index + dir + items.length) % items.length;
      onIndexChange(target);
      setSlide(dir === -1 ? Math.max(0, (items[target]?.images.length || 1) - 1) : 0);
    },
    [slide, slideCount, items, index, onIndexChange]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [go, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90" role="dialog" aria-modal="true" aria-label="Creative preview" onClick={onClose}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-white/70">
          {item.title || 'Creative'} · {index + 1} of {items.length}
        </p>
        <div className="flex rounded-lg bg-white/10 p-0.5" role="tablist" aria-label="Preview mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${mode === m.id ? 'bg-white text-neutral-900' : 'text-white/75 hover:text-white'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Close preview" className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-y-auto px-14 py-4">
        {(items.length > 1 || slideCount > 1) && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="fixed left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="fixed right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        <div onClick={(e) => e.stopPropagation()} className="m-auto flex items-center justify-center">
          {mode === 'instagram' ? (
            <InstagramPost item={item} brand={brand} slide={slide} onSlide={setSlide} />
          ) : mode === 'facebook' ? (
            <FacebookPost item={item} brand={brand} slide={slide} onSlide={setSlide} />
          ) : item.videoUrl ? (
            <video src={item.videoUrl} controls playsInline className="max-h-[calc(100vh-180px)] max-w-full rounded-lg shadow-2xl" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.images[slide]}
              alt={item.title || 'Creative'}
              className="max-h-[calc(100vh-180px)] max-w-full rounded-lg object-contain shadow-2xl"
            />
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-3 px-4 pb-5" onClick={(e) => e.stopPropagation()}>
        {slideCount > 1 && mode === 'full' && (
          <div className="flex gap-2 overflow-x-auto">
            {item.images.map((src, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={`h-16 w-[52px] shrink-0 overflow-hidden rounded-md border-2 ${i === slide ? 'border-white' : 'border-transparent opacity-60'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {renderActions && <div className="flex flex-wrap justify-center gap-2">{renderActions(item, index, slide)}</div>}
        <p className="text-[11px] text-white/40">← → to browse · Esc to close</p>
      </div>
    </div>
  );
}
