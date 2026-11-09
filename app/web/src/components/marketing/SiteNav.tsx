'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  CalendarDays,
  Camera,
  ChevronDown,
  Clapperboard,
  Eye,
  ImageIcon,
  Menu,
  ScanSearch,
  X,
  type LucideIcon,
  BarChart3,
} from 'lucide-react';
import { FEATURES, type Feature } from '@/content/features';
import { NAV, type NavLink } from '@/content/nav';
import { Badge } from './kit/Badge';
import { CTAButton } from './kit/CTAButton';

const FEATURE_ICONS: Record<string, LucideIcon> = {
  'ad-studio': ImageIcon,
  'ugc-video-ads': Clapperboard,
  'product-photoshoot': Camera,
  'brand-research': ScanSearch,
  'competitor-ad-watch': Eye,
  'ad-analytics': BarChart3,
  'content-calendar': CalendarDays,
};

const productItems: Feature[] = NAV.productFeatureIds
  .map((id) => FEATURES.find((f) => f.id === id))
  .filter((f): f is Feature => Boolean(f));

type MenuId = 'product' | 'solutions' | null;

function isExternal(href: string) {
  return /^https?:/.test(href);
}

function NavAnchor({ link, className, onClick }: { link: NavLink; className: string; onClick?: () => void }) {
  if (link.external || isExternal(link.href)) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className} onClick={onClick}>
      {link.label}
    </Link>
  );
}

/** One feature in the Product menu. "Coming soon" items are shown but not linked. */
function ProductItem({ feature, onNavigate, compact = false }: { feature: Feature; onNavigate: () => void; compact?: boolean }) {
  const Icon = FEATURE_ICONS[feature.id] ?? ImageIcon;
  const soon = feature.status === 'soon';
  const body = (
    <>
      <span aria-hidden className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${soon ? 'bg-paper-deep text-ink-mute' : 'bg-accent-wash text-accent-deep'}`}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-[15px] font-medium ${soon ? 'text-ink-soft' : 'text-ink'}`}>{feature.name}</span>
          {feature.status !== 'live' ? <Badge status={feature.status} /> : null}
        </span>
        {!compact ? <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-mute">{feature.short}</span> : null}
      </span>
    </>
  );
  const cls = 'flex items-start gap-3 rounded-2xl p-3';
  if (soon) {
    return <div className={cls}>{body}</div>;
  }
  return (
    <Link href={feature.href} onClick={onNavigate} className={`${cls} transition-colors hover:bg-paper`}>
      {body}
    </Link>
  );
}

/** Sticky marketing nav: Product mega menu, Solutions, Pricing, Book a demo; full-screen menu on mobile. */
export default function SiteNav() {
  const router = useRouter();
  const baseId = useId();
  const [menu, setMenu] = useState<MenuId>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<MenuId>(null);
  const [scrolled, setScrolled] = useState(false);
  const barRef = useRef<HTMLSpanElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<'product' | 'solutions', HTMLButtonElement | null>>({ product: null, solutions: null });
  const closeTimer = useRef<number | null>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);

  const closeAll = useCallback(() => {
    setMenu(null);
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      barRef.current?.style.setProperty('--p', max > 0 ? String(Math.min(1, window.scrollY / max)) : '0');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close on navigation.
  useEffect(() => {
    router.events.on('routeChangeStart', closeAll);
    router.events.on('hashChangeStart', closeAll);
    return () => {
      router.events.off('routeChangeStart', closeAll);
      router.events.off('hashChangeStart', closeAll);
    };
  }, [router.events, closeAll]);

  // Desktop dropdowns: Escape returns focus to the trigger; outside click closes.
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const open = menu;
        setMenu(null);
        if (open) triggerRefs.current[open]?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [menu]);

  // Mobile menu: lock page scroll, Escape closes, focus the close button on open.
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  // Pointer hover opens a menu after a short delay (keyboard and touch use click).
  const hoverOpen = (id: 'product' | 'solutions') => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setMenu(id);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    closeTimer.current = window.setTimeout(() => setMenu(null), 160);
  };

  // Close a dropdown when keyboard focus leaves it.
  const onBlurWithin = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenu(null);
  };

  const productPanelId = `${baseId}-product`;
  const solutionsPanelId = `${baseId}-solutions`;
  const mobileId = `${baseId}-mobile`;

  const trigger = (id: 'product' | 'solutions', label: string, panelId: string) => (
    <button
      ref={(el) => {
        triggerRefs.current[id] = el;
      }}
      type="button"
      aria-expanded={menu === id}
      aria-controls={panelId}
      onClick={() => setMenu((m) => (m === id ? null : id))}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-[15px] transition-colors hover:text-ink ${menu === id ? 'text-ink' : 'text-ink-soft'}`}
    >
      {label}
      <ChevronDown aria-hidden className={`h-4 w-4 transition-transform duration-200 ${menu === id ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <header className="sticky top-0 z-50 px-2 pt-2 sm:px-4 md:pt-3">
      <div ref={navRef} className="relative mx-auto max-w-6xl">
        {/* Floating bar: transparent at the top, a frosted pill once the page scrolls. */}
        <div
          className={`relative flex h-14 items-center justify-between gap-3 rounded-full px-3 transition-[background-color,box-shadow,border-color] duration-300 sm:px-4 ${
            scrolled || menu
              ? 'border border-line bg-surface/90 shadow-[0_12px_32px_-20px_rgba(23,20,15,0.45)] backdrop-blur-md'
              : 'border border-transparent bg-transparent'
          }`}
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-6 bottom-0 h-[2px] overflow-hidden rounded-full">
            <span ref={barRef} className={`sx-progress block h-full bg-accent transition-opacity ${scrolled ? 'opacity-100' : 'opacity-0'}`} />
          </span>

          <Link href="/" className="flex shrink-0 items-center" aria-label="SkalX home">
            <Image src="/images/SkalX_Logo.png" alt="SkalX" width={85} height={24} className="h-6 w-auto" priority />
          </Link>

          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              <li onPointerEnter={hoverOpen('product')} onPointerLeave={hoverClose} onBlur={onBlurWithin}>
                {trigger('product', NAV.productLabel, productPanelId)}
              </li>
              <li onPointerEnter={hoverOpen('solutions')} onPointerLeave={hoverClose} onBlur={onBlurWithin}>
                {trigger('solutions', NAV.solutionsLabel, solutionsPanelId)}
              </li>
              {NAV.links.map((l) => (
                <li key={l.label}>
                  <NavAnchor link={l} className="rounded-full px-3 py-2 text-[15px] text-ink-soft transition-colors hover:text-ink" />
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href={NAV.logIn.href} className="hidden rounded-full px-3 py-2 text-[15px] text-ink-soft transition-colors hover:text-ink sm:inline-flex">
              {NAV.logIn.label}
            </Link>
            <CTAButton href={NAV.startFree.href} size="md" className="!min-h-10 px-4">
              {NAV.startFree.label}
            </CTAButton>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-paper-deep lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls={mobileId}
              aria-label="Open menu"
              onClick={() => {
                setMobileSection(null);
                setMobileOpen(true);
              }}
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        {/* Desktop: Product mega menu */}
        <div
          id={productPanelId}
          hidden={menu !== 'product'}
          onPointerEnter={hoverOpen('product')}
          onPointerLeave={hoverClose}
          onBlur={onBlurWithin}
          className={`absolute left-0 right-0 top-full z-10 hidden pt-2 ${menu === 'product' ? 'lg:block' : ''}`}
        >
          <div className="sx-enter-menu grid grid-cols-[1fr_17rem] overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_30px_60px_-30px_rgba(23,20,15,0.5)]">
            <ul className="grid grid-cols-2 gap-1 p-3">
              {productItems.map((f) => (
                <li key={f.id}>
                  <ProductItem feature={f} onNavigate={() => setMenu(null)} />
                </li>
              ))}
            </ul>
            <div className="flex flex-col justify-between border-l border-line bg-paper p-6">
              <p className="font-display text-xl font-semibold leading-snug tracking-[-0.02em]">{NAV.productFooterNote}</p>
              <CTAButton href={NAV.startFree.href} size="md" arrow className="mt-6 self-start">
                {NAV.startFree.label}
              </CTAButton>
            </div>
          </div>
        </div>

        {/* Desktop: Solutions menu */}
        <div
          id={solutionsPanelId}
          hidden={menu !== 'solutions'}
          onPointerEnter={hoverOpen('solutions')}
          onPointerLeave={hoverClose}
          onBlur={onBlurWithin}
          className={`absolute left-[9.5rem] top-full z-10 hidden w-[24rem] pt-2 ${menu === 'solutions' ? 'lg:block' : ''}`}
        >
          <ul className="sx-enter-menu overflow-hidden rounded-[24px] border border-line bg-surface p-3 shadow-[0_30px_60px_-30px_rgba(23,20,15,0.5)]">
            {NAV.solutions.map((s) => (
              <li key={s.label}>
                <Link href={s.href} onClick={() => setMenu(null)} className="block rounded-2xl p-3 transition-colors hover:bg-paper">
                  <span className="block text-[15px] font-medium text-ink">{s.label}</span>
                  {s.description ? <span className="mt-0.5 block text-[13.5px] text-ink-mute">{s.description}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile: full-screen menu with accordions */}
      <div
        id={mobileId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        hidden={!mobileOpen}
        className={`fixed inset-0 z-[70] flex-col bg-paper lg:hidden ${mobileOpen ? 'flex' : 'hidden'}`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" aria-label="SkalX home" onClick={() => setMobileOpen(false)}>
            <Image src="/images/SkalX_Logo.png" alt="SkalX" width={85} height={24} className="h-6 w-auto" />
          </Link>
          <button
            ref={mobileCloseRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-paper-deep"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-4 pb-6">
          <ul className="divide-y divide-line border-y border-line">
            {(
              [
                ['product', NAV.productLabel],
                ['solutions', NAV.solutionsLabel],
              ] as const
            ).map(([id, label]) => {
              const open = mobileSection === id;
              const panel = `${mobileId}-${id}`;
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panel}
                    onClick={() => setMobileSection(open ? null : id)}
                    className="flex w-full items-center justify-between py-4 text-left text-xl font-medium text-ink"
                  >
                    {label}
                    <ChevronDown aria-hidden className={`h-5 w-5 text-ink-mute transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  <div id={panel} hidden={!open} className="pb-3">
                    {id === 'product' ? (
                      <ul>
                        {productItems.map((f) => (
                          <li key={f.id}>
                            <ProductItem feature={f} compact onNavigate={() => setMobileOpen(false)} />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul>
                        {NAV.solutions.map((s) => (
                          <li key={s.label}>
                            <Link href={s.href} onClick={() => setMobileOpen(false)} className="block rounded-2xl p-3 text-[15px] font-medium text-ink">
                              {s.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              );
            })}
            {NAV.links.map((l) => (
              <li key={l.label}>
                <NavAnchor link={l} onClick={() => setMobileOpen(false)} className="block py-4 text-xl font-medium text-ink" />
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid grid-cols-2 gap-3 border-t border-line p-4">
          <CTAButton href={NAV.logIn.href} variant="secondary" size="lg" onClick={() => setMobileOpen(false)}>
            {NAV.logIn.label}
          </CTAButton>
          <CTAButton href={NAV.startFree.href} size="lg" onClick={() => setMobileOpen(false)}>
            {NAV.startFree.label}
          </CTAButton>
        </div>
      </div>
    </header>
  );
}
