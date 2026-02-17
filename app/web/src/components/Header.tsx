'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { Menu, X } from 'lucide-react';
import colors from '@/lib/ui/colors';

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: 'Home', href: '/', type: 'route' },
    { name: 'About', href: '/About', type: 'route' },
    { name: 'Pricing', href: '/#pricing', type: 'section' },
    { name: 'How It Works', href: '/#how-it-works', type: 'section' },
    { name: 'FAQ', href: '/#faq', type: 'section' },
    { name: 'Contact', href: '/Contact', type: 'route' },
  ];

  const handleSectionClick = (href: string) => {
    // href is like "/#pricing"
    if (pathname !== '/') {
      // If not on home, navigate to the home with hash
      router.push(href);
    } else {
      // On home page: smooth scroll to element id
      const elementId = href.startsWith('/#') ? href.substring(2) : href.replace('#', '');
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      } else {
        // Fallback: update URL hash so user can refresh to land there
        window.location.hash = `#${elementId}`;
      }
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 pt-4">
      <div
        className="mx-auto max-w-5xl rounded-2xl backdrop-blur-xl border"
        style={{
          background: 'hsl(0 0% 9% / 0.75)',
          borderColor: 'rgba(255,255,255,0.06)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 0 1px rgba(255,255,255,0.05)',
          color: colors.foreground,
        }}
      >
        <div className="flex items-center justify-between h-14 px-4 sm:px-6">
          <Link href="/" className="flex items-center" style={{ color: colors.foreground }}>
            <span className="text-xl font-bold" style={{ lineHeight: 1, color: colors.foreground }}>SkalX AI</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navItems.map((item) => {
              if (item.type === 'section') {
                return (
                  <button
                    key={item.name}
                    onClick={() => handleSectionClick(item.href)}
                    className="transition-all duration-300 font-medium relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
                    // token-based default + hover handlers (color-only)
                    style={{
                      color: colors.foreground,
                      background: 'transparent',
                      padding: 0,
                      border: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = colors.primary;
                      // animate underline color by setting CSS variable for after if needed
                      (e.currentTarget as HTMLElement).style.setProperty('--after-bg', colors.primary);
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = colors.foreground;
                    }}
                  >
                    {item.name}
                  </button>
                );
              }

              // route link
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className="transition-all duration-300 font-medium relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
                  style={{
                    color: isActive ? colors.primary : colors.foreground,
                    textDecoration: 'none',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = isActive ? colors.primary : colors.foreground;
                  }}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center space-x-4">
            <Link
              href="/auth/signin"
              className="text-sm font-medium transition-colors"
              style={{ color: colors.mutedForeground }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = colors.primary; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = colors.mutedForeground; }}
            >
              Sign In
            </Link>
            <Link href="/auth/signup">
              <Button variant="cta">Start Free</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen((s) => !s)}
              style={{
                color: colors.foreground,
                background: 'transparent',
                border: 'none',
              }}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div
            className="lg:hidden rounded-b-2xl overflow-hidden"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="px-2 pt-2 pb-4 space-y-1">
              {navItems.map((item) => {
                if (item.type === 'section') {
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        handleSectionClick(item.href);
                        setIsMenuOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 transition-all duration-300 font-medium rounded-md"
                      style={{
                        color: colors.foreground,
                        background: 'transparent',
                        border: 'none',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = colors.primary;
                        (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(213 100% 55% / 0.12)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = colors.foreground;
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }}
                    >
                      {item.name}
                    </button>
                  );
                }

                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-2 transition-all duration-300 font-medium rounded-md"
                    style={{
                      color: isActive ? colors.primary : colors.foreground,
                      backgroundColor: isActive ? "hsl(213 100% 55% / 0.12)" : 'transparent',
                      textDecoration: 'none',
                    }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = colors.primary;
                        (e.currentTarget as HTMLElement).style.backgroundColor = "hsl(213 100% 55% / 0.12)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = isActive ? colors.primary : colors.foreground;
                        (e.currentTarget as HTMLElement).style.backgroundColor = isActive ? "hsl(213 100% 55% / 0.12)" : 'transparent';
                      }}
                  >
                    {item.name}
                  </Link>
                );
              })}

              <div className="flex flex-col space-y-2 pt-4">
                <Link href="/auth/signin" onClick={() => setIsMenuOpen(false)} className="text-sm font-medium px-3 py-2" style={{ color: colors.mutedForeground }}>
                  Sign In
                </Link>
                <Link href="/auth/signup" onClick={() => setIsMenuOpen(false)}>
                  <Button variant="cta" className="justify-start w-full">Start Free</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
