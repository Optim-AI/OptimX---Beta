import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Facebook, Instagram, Linkedin, Twitter, Youtube, type LucideIcon } from 'lucide-react';
import { FEATURES } from '@/content/features';
import { FOOTER, type NavLink } from '@/content/nav';
import { COMPANY, SOCIALS, type Social } from '@/content/site';

const SOCIAL_ICONS: Record<Social['icon'], LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  x: Twitter,
};

/** Live and beta features first in the Product column; "soon" features are left out. */
const productLinks: NavLink[] = FEATURES.filter((f) => f.status !== 'soon' && f.href).map((f) => ({ label: f.name, href: f.href }));

function FooterLink({ link }: { link: NavLink }) {
  const cls = 'sx-link sx-link-grow text-ink-soft transition-colors hover:text-ink';
  if (link.external || /^https?:/.test(link.href)) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={cls}>
      {link.label}
    </Link>
  );
}

export default function SiteFooter() {
  const groups = FOOTER.groups.map((g) => (g.title === 'Product' ? { ...g, links: [...productLinks, ...g.links] } : g));
  return (
    <footer className="sx-sheet relative overflow-hidden bg-paper-deep text-ink">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-16 sm:px-6 md:pt-20">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12">
          <div className="col-span-2 md:col-span-12 lg:col-span-2">
            <Image src="/images/SkalX_Logo.png" alt="SkalX" width={99} height={28} className="h-7 w-auto" />
            <p className="mt-4 max-w-xs text-ink-soft">{FOOTER.tagline}</p>
            <a href={`mailto:${COMPANY.supportEmail}`} className="sx-link mt-3 inline-block text-ink">
              {COMPANY.supportEmail}
            </a>
            {SOCIALS.length ? (
              <ul className="mt-5 flex gap-2">
                {SOCIALS.map((s) => {
                  const Icon = SOCIAL_ICONS[s.icon];
                  return (
                    <li key={s.href}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/20 text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title} className="md:col-span-4 lg:col-span-2">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-ink-mute">{group.title}</h2>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.label}`}>
                    <FooterLink link={link} />
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-mute md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="font-medium text-ink-soft">{COMPANY.madeIn}</p>
            <p>
              © {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.
            </p>
          </div>
          <p className="md:text-right">
            GSTIN {COMPANY.gstin}
            <br />
            Prices exclude 18% GST unless stated.
          </p>
        </div>
      </div>
      {/* Oversized wordmark, cropped by the page edge. Decorative. */}
      <p
        aria-hidden
        className="pointer-events-none -mb-[0.22em] select-none text-center font-display text-[clamp(6rem,27vw,23rem)] font-extrabold leading-none tracking-[-0.06em] text-ink/[0.06]"
      >
        SkalX
      </p>
    </footer>
  );
}
