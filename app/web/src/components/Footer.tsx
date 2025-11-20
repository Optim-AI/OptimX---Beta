'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import colors from '../../../../lib/colors';

// const optimLogo = '/lovable-uploads/97baedae-c6f2-422c-95ad-b5efa06f182e.png';

type LinkItem = { name: string; href: string; type: 'route' | 'section' };

const Footer: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  // === Existing footer links you had + the new ones the user asked for.
  // We'll dedupe by name to avoid duplicates.
  const requested: Record<string, LinkItem[]> = {
    Product: [
      { name: 'Features', href: '/#features', type: 'section' },
      { name: 'Pricing', href: '/#pricing', type: 'section' },
      { name: 'Roadmap', href: '/roadmap', type: 'route' },
    ],
    Company: [
      { name: 'About', href: '/About', type: 'route' },
      { name: 'Careers', href: '/Careers', type: 'route' },
      { name: 'Blog', href: '/blog', type: 'route' },
      { name: 'Press', href: '/press', type: 'route' },
    ],
    Resources: [
      { name: 'Help Center', href: '/help-center', type: 'route' },
      { name: 'Tutorials', href: '/tutorials', type: 'route' },
      { name: 'API Docs', href: '/api-Docs', type: 'route' },
      { name: 'Community', href: '/community', type: 'route' },
    ],
    Legal: [
      { name: 'Terms & Conditions', href: '/terms-and-conditions', type: 'route' },
      { name: 'Privacy Policy', href: '/privacy-policy', type: 'route' },
      { name: 'Refund Policy', href: '/refund-cancellation', type: 'route' },
      { name: 'Cookie Policy', href: '/cookiepolicy', type: 'route' },
      { name: 'Data Handling & Security', href: '/data-handling-security', type: 'route' },
      { name: 'AI Use Disclosure', href: '/ai-disclosure', type: 'route' },
    ],
  };

  // Your original footerLinks (kept as source of truth)
  const original: Record<string, LinkItem[]> = {
    Product: [
      { name: 'Features', href: '/#features', type: 'section' },
      { name: 'How it Works', href: '/#how-it-works', type: 'section' },
      { name: 'Pricing', href: '/#pricing', type: 'section' },
    ],
    Company: [
      { name: 'About', href: '/about', type: 'route' },
      { name: 'Careers', href: '/careers', type: 'route' },
      { name: 'Blog', href: '/blog', type: 'route' },
      { name: 'Contact', href: '/Contact', type: 'route' },
    ],
  };

  // Merge original + requested and dedupe by name
  const mergedFooterLinks: Record<string, LinkItem[]> = {};

  const addCategory = (category: string, items: LinkItem[] = []) => {
    if (!mergedFooterLinks[category]) mergedFooterLinks[category] = [];
    const map = new Map<string, LinkItem>();
    // start with existing items already present (if any)
    mergedFooterLinks[category].forEach((it) => map.set(it.name, it));
    items.forEach((it) => map.set(it.name, it));
    mergedFooterLinks[category] = Array.from(map.values());
  };

  // seed with original categories first (so we preserve their order)
  Object.entries(original).forEach(([cat, items]) => addCategory(cat, items));
  // then requested categories (this will add new categories and new items)
  Object.entries(requested).forEach(([cat, items]) => addCategory(cat, items));

  // If any requested category wasn't present originally, add it now (ensures Resources & Legal are included)
  Object.keys(requested).forEach((cat) => {
    if (!mergedFooterLinks[cat]) mergedFooterLinks[cat] = requested[cat];
  });

  const footerCategoriesOrdered = [
    // keep logo/desc first (handled separately), then categories in a sensible order
    'Product',
    'Company',
    'Resources',
    'Legal',
  ];

  const handleSectionClick = (href: string) => {
    if (pathname !== '/') {
      router.push(href);
    } else {
      // href like '/#pricing' or '#pricing' or '/#features'
      const selector = href.startsWith('/#') ? `#${href.substring(2)}` : href.startsWith('#') ? href : href.replace('/#', '#');
      const element = document.querySelector(selector);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      } else {
        // fallback to set hash so refresh lands there
        if (selector.startsWith('#')) window.location.hash = selector;
      }
    }
  };

  const socialLinks = [
    {
      name: 'Facebook',
      icon: Facebook,
      href: 'https://www.facebook.com/profile.php?id=61571446107024',
    },
    {
      name: 'Instagram',
      icon: Instagram,
      href: 'https://www.instagram.com/optimx.ai/?utm_source=qr',
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      href: 'https://www.linkedin.com/company/optim01/?viewAsMember=true',
    },
    { name: 'Twitter', icon: Twitter, href: '#' },
  ];

  return (
    <footer
      // color-only changes: background, border
      style={{
        backgroundColor: 'hsl(220 13% 95% / 0.5)',
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {/* Logo + description */}
          <div className="col-span-2">
            <div className="flex items-center space-x-1 mb-4">
              <img src="/images/OptimX_Logo.svg" alt="OptimX Logo" className="h-8 w-8" />
              <span className="text-xl font-bold" style={{ display: 'inline-flex', gap: 0 }}>
                <span style={{ color: colors.foreground }}>Optim</span>
                <span style={{ color: colors.primary }}>X</span>
              </span>
            </div>

            <p className="leading-relaxed mb-4" style={{ color: colors.mutedForeground }}>
              Your all-in-one marketing brain. AI-powered campaigns for small businesses, designed to help you grow without the complexity.
            </p>

            <p className="mb-6" style={{ color: colors.mutedForeground }}>
              <strong style={{ color: colors.foreground }}>Contact:</strong>{' '}
              <a
                href="mailto:info@optimx.app"
                className="transition-colors"
                style={{ color: colors.mutedForeground }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = colors.primary)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = colors.mutedForeground)}
              >
                info@optimx.app
              </a>{' '}
              |{' '}
              <a
                href="tel:+919003815101"
                className="transition-colors"
                style={{ color: colors.mutedForeground }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = colors.primary)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = colors.mutedForeground)}
              >
                +91 9003815101
              </a>
            </p>

            <div className="flex space-x-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className="flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground,
                      boxShadow: colors.shadowSoft,
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.backgroundColor = colors.primary;
                      el.style.color = colors.primaryForeground;
                      el.style.boxShadow = colors.shadowGlow;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.backgroundColor = colors.background;
                      el.style.color = colors.foreground;
                      el.style.boxShadow = colors.shadowSoft;
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Footer link columns (Product, Company, Resources, Legal) */}
          {footerCategoriesOrdered.map((category) => {
            const links = mergedFooterLinks[category] ?? [];
            if (!links.length) return null;
            return (
              <div key={category}>
                <h3 className="font-semibold mb-4" style={{ color: colors.foreground }}>
                  {category}
                </h3>
                <ul className="space-y-3">
                  {links.map((link) => (
                    <li key={link.name}>
                      {link.type === 'section' ? (
                        <button
                          onClick={() => handleSectionClick(link.href)}
                          className="transition-colors duration-200"
                          style={{ color: colors.mutedForeground, background: 'transparent', border: 'none', padding: 0 }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = colors.primary)}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = colors.mutedForeground)}
                        >
                          {link.name}
                        </button>
                      ) : (
                        <Link
                          href={link.href}
                          className="transition-colors duration-200"
                          style={{ color: colors.mutedForeground, textDecoration: 'none' }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = colors.primary)}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = colors.mutedForeground)}
                        >
                          {link.name}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div
          className="mt-12 pt-8 flex flex-col md:flex-row items-center justify-between"
          style={{ borderTop: `1px solid ${colors.border}`, gap: 12 }}
        >
          <div style={{ color: colors.mutedForeground, fontSize: 14 }} className="mb-4 md:mb-0">
            © {new Date().getFullYear()} OptimX. All rights reserved.
          </div>
          <div style={{ color: colors.mutedForeground, fontSize: 14 }}>
            Made with ❤️ for small & Medium businesses everywhere
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
