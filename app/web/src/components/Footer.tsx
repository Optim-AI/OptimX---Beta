'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Facebook, Instagram, Linkedin } from 'lucide-react';
import colors from '@/lib/ui/colors';

type LinkItem = { name: string; href: string; type: 'route' | 'section' };

const Footer: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const footerLinks: Record<string, LinkItem[]> = {
    Product: [
      { name: 'Features', href: '/#system', type: 'section' },
      { name: 'Pricing', href: '/#pricing', type: 'section' },
      { name: 'Use Cases', href: '/use-cases', type: 'route' },
      { name: 'Blog', href: '/blog', type: 'route' },
    ],
    Legal: [
      { name: 'Terms & Conditions', href: '/terms-and-conditions', type: 'route' },
      { name: 'Privacy Policy', href: '/privacy-policy', type: 'route' },
      { name: 'Refund Policy', href: '/refund-cancellation', type: 'route' },
      { name: 'Cookie Policy', href: '/cookiepolicy', type: 'route' },
      { name: 'Data Handling & Security', href: '/data-handling-security', type: 'route' },
      { name: 'AI Use Disclosure', href: '/ai-disclosure', type: 'route' },
    ],
    Support: [
      { name: 'Contact', href: '/Contact', type: 'route' },
      { name: 'Support', href: '/help-center', type: 'route' },
    ],
  };

  const socialLinks = [
    { name: 'Facebook', icon: Facebook, href: 'https://www.facebook.com/share/1BNxZDcfRe/?mibextid=wwXIfr' },
    { name: 'Instagram', icon: Instagram, href: 'https://www.instagram.com/optimx.ai/?utm_source=qr' },
    { name: 'LinkedIn', icon: Linkedin, href: 'https://www.linkedin.com/company/optim01/?viewAsMember=true' },
  ];

  const handleSectionClick = (href: string) => {
    if (pathname !== '/') router.push(href);
    else {
      const selector = href.startsWith('/#') ? `#${href.substring(2)}` : href.startsWith('#') ? href : href.replace('/#', '#');
      const element = document.querySelector(selector);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
      else if (selector.startsWith('#')) window.location.hash = selector;
    }
  };

  return (
    <footer style={{ backgroundColor: '#121212', borderTop: `1px solid ${colors.border}` }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <img src="/images/SkalX_Logo.png" alt="SkalX AI Logo" className="h-8 w-auto object-contain" />
              <span className="text-xl font-bold" style={{ color: colors.foreground }}>SkalX AI</span>
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: colors.mutedForeground }}>
              An AI Marketing Team — Without Expanding Headcount.
            </p>
            <Link href="/auth/signup" className="text-sm font-medium" style={{ color: colors.primary }}>Start Free →</Link>
          </div>

          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold mb-4" style={{ color: colors.foreground }}>{category}</h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    {link.type === 'section' ? (
                      <button
                        onClick={() => handleSectionClick(link.href)}
                        className="text-left transition-colors duration-200"
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
          ))}

          <div>
            <h3 className="font-semibold mb-4" style={{ color: colors.foreground }}>Connect</h3>
            <div className="flex gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300"
                    style={{ backgroundColor: colors.muted, color: colors.foreground }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.backgroundColor = colors.primary;
                      el.style.color = colors.primaryForeground;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.backgroundColor = colors.muted;
                      el.style.color = colors.foreground;
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="mt-12 pt-8 flex flex-col md:flex-row items-center justify-between"
          style={{ borderTop: `1px solid ${colors.border}`, gap: 12 }}
        >
          <div style={{ color: colors.mutedForeground, fontSize: 14 }}>
            © {new Date().getFullYear()} SkalX AI. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
