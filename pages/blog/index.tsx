'use client';

import React from 'react';
import Link from 'next/link';
import Header from '@/app/web/src/components/Header';
import Footer from '@/app/web/src/components/Footer';
import colors from '@/lib/ui/colors';

export default function BlogPage() {
  return (
    <div style={{ minHeight: '100vh', background: colors.background, color: colors.foreground }}>
      <Header />
      <main className="pt-24 pb-24">
        <section className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-6" style={{ color: colors.foreground }}>
            Blog
          </h1>
          <p className="text-lg mb-12" style={{ color: colors.mutedForeground }}>
            AI marketing tips, campaign best practices, and product updates.
          </p>
          <div className="rounded-2xl p-8 text-center" style={{ background: 'hsl(0 0% 14% / 0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="mb-6" style={{ color: colors.mutedForeground }}>Coming soon. Stay tuned for insights on scaling marketing with AI.</p>
            <Link href="/" className="font-medium" style={{ color: colors.primary }}>← Back to Home</Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
