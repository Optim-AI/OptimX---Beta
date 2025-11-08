'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';
import colors from '../../../../lib/colors';

const optimLogo = '/lovable-uploads/97baedae-c6f2-422c-95ad-b5efa06f182e.png';

const Footer: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();

  const footerLinks = {
    Product: [
      { name: 'Features', href: '/#features', type: 'section' },
      { name: 'How it Works', href: '/#how-it-works', type: 'section' },
      { name: 'Pricing', href: '/#pricing', type: 'section' }
    ],
    Company: [
      { name: 'About', href: '/about', type: 'route' },
      { name: 'Careers', href: '/careers', type: 'route' },
      { name: 'Blog', href: '/blog', type: 'route' },
      { name: 'Contact', href: '/contact', type: 'route' }
    ]
  };

  const handleSectionClick = (href: string) => {
    if (pathname !== '/') {
      router.push(href);
    } else {
      const element = document.querySelector(href); // e.g. "#pricing"
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const socialLinks = [
    {
      name: 'Facebook',
      icon: Facebook,
      href: 'https://www.facebook.com/profile.php?id=61571446107024'
    },
    {
      name: 'Instagram',
      icon: Instagram,
      href: 'https://www.instagram.com/optimx.ai/?utm_source=qr'
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      href: 'https://www.linkedin.com/company/optim01/?viewAsMember=true'
    },
    { name: 'Twitter', icon: Twitter, href: '#' }
  ];

  return (
    <footer
      // color-only changes: background, border
      style={{
        backgroundColor: `${colors.muted} / 0.5`,
        borderTop: `1px solid ${colors.border}`,
      }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
          {/* Logo + description */}
          <div className="col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <img src={optimLogo} alt="OptimX Logo" className="h-8 w-8" />
              <span className="text-xl font-bold" style={{ display: 'inline-flex', gap: 6 }}>
                <span style={{ color: colors.foreground }}>Optim</span>
                <span
                  // text-primary replaced by token
                  style={{ color: colors.primary }}
                >
                  X
                </span>
              </span>
            </div>

            <p className="leading-relaxed mb-4" style={{ color: colors.mutedForeground }}>
              Your all-in-one marketing brain. AI-powered campaigns for small
              businesses, designed to help you grow without the complexity.
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

          {/* Footer link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
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
                        style={{ color: colors.mutedForeground }}
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
        </div>

        <div
          className="mt-12 pt-8 flex flex-col md:flex-row items-center justify-between"
          style={{ borderTop: `1px solid ${colors.border}`, gap: 12 }}
        >
          <div style={{ color: colors.mutedForeground, fontSize: 14 }} className="mb-4 md:mb-0">
            © 2024 OptimX. All rights reserved.
          </div>
          <div style={{ color: colors.mutedForeground, fontSize: 14 }}>
            Made with ❤️ for small businesses everywhere
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
