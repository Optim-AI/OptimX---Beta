'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, X } from 'lucide-react';
import { LOGIN_HREF, SIGNUP_HREF, START_HREF } from '@/lib/marketing/content';

const NAV_ITEMS = [
  { name: 'How it works', href: '/#how-it-works' },
  { name: 'What you get', href: '/#what-you-get' },
  { name: 'Pricing', href: '/pricing' },
  { name: 'About', href: '/About' },
] as const;

/** Sticky, minimal marketing nav. Mobile: logo + "Get a free ad" + menu. */
export default function SiteNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on('routeChangeStart', close);
    router.events.on('hashChangeStart', close);
    return () => {
      router.events.off('routeChangeStart', close);
      router.events.off('hashChangeStart', close);
    };
  }, [router.events]);

  const isActive = (href: string) => !href.includes('#') && router.pathname === href;

  return (
    <header
      className={`sticky top-0 z-50 bg-paper/95 backdrop-blur-sm transition-shadow ${
        scrolled || open ? 'shadow-[0_1px_0_var(--color-line)]' : ''
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center" aria-label="SkalX home">
          <Image src="/images/SkalX_Logo.png" alt="SkalX" width={85} height={24} className="h-6 w-auto" priority />
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-8 text-[15px]">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className="text-ink-soft underline-offset-4 hover:text-ink hover:underline aria-[current=page]:text-ink aria-[current=page]:underline"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link href={LOGIN_HREF} className="hidden px-2 text-sm text-ink-soft hover:text-ink md:inline">
            Log in
          </Link>
          <Link
            href={SIGNUP_HREF}
            className="mr-1 hidden h-10 items-center rounded-full border border-ink/25 px-4 text-sm font-medium text-ink hover:border-ink md:inline-flex"
          >
            Sign up
          </Link>
          <Link
            href={START_HREF}
            className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-accent-deep sm:px-5"
          >
            Get a free ad
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-paper-deep md:hidden"
            aria-expanded={open}
            aria-controls="sx-mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      <nav
        id="sx-mobile-menu"
        aria-label="Main"
        hidden={!open}
        className="border-t border-line bg-paper px-4 pb-6 pt-2 md:hidden"
      >
        <ul className="divide-y divide-line">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block py-3 text-lg text-ink"
              >
                {item.name}
              </Link>
            </li>
          ))}
          <li>
            <Link href={SIGNUP_HREF} onClick={() => setOpen(false)} className="block py-3 text-lg text-ink">
              Sign up
            </Link>
          </li>
          <li>
            <Link href={LOGIN_HREF} onClick={() => setOpen(false)} className="block py-3 text-lg text-ink-soft">
              Log in
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
