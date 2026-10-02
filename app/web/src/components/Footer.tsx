'use client';

import React from 'react';
import Link from 'next/link';
import colors from '@/lib/ui/colors';

/**
 * Minimal marketing footer — legal + entry, no long link grids.
 */
const Footer: React.FC = () => {
  return (
    <footer style={{ backgroundColor: '#121212', borderTop: `1px solid ${colors.border}` }}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src="/images/SkalX_Logo.png"
              alt="SkalX AI"
              className="h-5 w-auto object-contain"
            />
            <Link href="/try" className="text-sm font-medium" style={{ color: colors.primary }}>
              Get Started →
            </Link>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Legal">
            <Link href="/privacy-policy" style={{ color: colors.mutedForeground, textDecoration: 'none' }}>
              Privacy
            </Link>
            <Link href="/terms-and-conditions" style={{ color: colors.mutedForeground, textDecoration: 'none' }}>
              Terms
            </Link>
            <Link href="/cpolicy" style={{ color: colors.mutedForeground, textDecoration: 'none' }}>
              Cookies
            </Link>
            <Link href="/Contact" style={{ color: colors.mutedForeground, textDecoration: 'none' }}>
              Contact
            </Link>
            <Link href="/help-center" style={{ color: colors.mutedForeground, textDecoration: 'none' }}>
              Support
            </Link>
          </nav>
        </div>
        <p className="mt-8 text-sm" style={{ color: colors.mutedForeground }}>
          © {new Date().getFullYear()} SkalX AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
