import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Facebook } from 'lucide-react';
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';

// Same destinations as the legacy footer; section links point at the new homepage sections.
const FOOTER_LINKS: Record<string, { name: string; href: string }[]> = {
  Product: [
    { name: 'What SkalX does', href: '/#what-you-get' },
    { name: 'AI Ad Generator', href: '/ai-ad-generator' },
    { name: 'How It Works', href: '/#how-it-works' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'Get a free ad', href: '/free-ad' },
  ],
  Company: [
    { name: 'About SkalX AI', href: '/About' },
    { name: 'Contact', href: '/Contact' },
    { name: 'FAQ', href: '/#faq' },
  ],
  Legal: [
    { name: 'Privacy', href: '/privacy-policy' },
    { name: 'Terms', href: '/terms-and-conditions' },
    { name: 'Cookies', href: '/cpolicy' },
    { name: 'AI Disclosure', href: '/ai-disclosure' },
  ],
  Support: [
    { name: 'Contact', href: '/Contact' },
    { name: 'Help Center', href: '/help-center' },
  ],
};

export default function SiteFooter() {
  return (
    <footer className="border-t border-line bg-paper-deep text-ink">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-12">
          <div className="col-span-2 md:col-span-4">
            <Image src="/images/SkalX_Logo.png" alt="SkalX" width={99} height={28} className="h-7 w-auto" />
            <p className="mt-4 max-w-xs text-ink-soft">Market research to ready-to-post creatives, for D2C brands. Built in Chennai.</p>
            <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className="mt-3 inline-block text-ink underline underline-offset-4">
              {SITE_SUPPORT_EMAIL}
            </a>
          </div>
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group} className="md:col-span-2">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-ink-mute">{group}</h2>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={`${group}-${link.name}`}>
                    <Link href={link.href} className="text-ink-soft hover:text-ink hover:underline underline-offset-4">
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col-reverse items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-sm text-ink-mute">© {new Date().getFullYear()} SkalX AI. All rights reserved.</p>
          <a
            href="https://www.facebook.com/share/1BNxZDcfRe/?mibextid=wwXIfr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="SkalX on Facebook"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-ink hover:bg-surface"
          >
            <Facebook className="h-4 w-4" aria-hidden />
          </a>
        </div>
      </div>
    </footer>
  );
}
