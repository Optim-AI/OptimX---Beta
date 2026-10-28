// app/web/src/components/creative-studio/BrandKitCard.tsx
import React from 'react';
import Link from 'next/link';
import colors from '@/lib/ui/colors';
import type { BrandSnapshot } from './types';

/**
 * Summary of the user's default Brand Kit (served as a BrandSnapshot by
 * /api/brand/snapshot). Replaces the old Brand Guideline card; editing
 * happens on the Brand Kit page.
 */
export default function BrandKitCard({ brand }: { brand: BrandSnapshot | null }) {
  const swatches = (brand?.primaryColors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5);
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>Brand Kit</h2>
        <Link href="/brand-kit" className="text-sm font-medium" style={{ color: colors.primary }}>
          {brand ? 'View / Edit' : 'Set up'}
        </Link>
      </div>
      <Link
        href="/brand-kit"
        className="block p-4 rounded-xl transition-colors hover:brightness-110"
        style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}
      >
        {brand ? (
          <div className="flex flex-wrap items-center gap-4">
            {brand.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logo}
                alt={`${brand.name} logo`}
                className="h-12 w-12 object-contain rounded-lg p-1"
                style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.card }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold" style={{ color: colors.foreground }}>{brand.name}</h3>
              <p className="text-sm line-clamp-2" style={{ color: colors.mutedForeground }}>
                {brand.offering || brand.description || 'Add what you sell and who it is for in your Brand Kit.'}
              </p>
            </div>
            {(swatches.length > 0 || brand.primaryFont) && (
              <div className="flex items-center gap-3">
                {swatches.length > 0 && (
                  <div className="flex -space-x-1" aria-label="Brand colours">
                    {swatches.map((c) => (
                      <span
                        key={c}
                        title={c}
                        className="h-6 w-6 rounded-full"
                        style={{ backgroundColor: c, border: `2px solid ${colors.muted}` }}
                      />
                    ))}
                  </div>
                )}
                {brand.primaryFont && (
                  <span className="text-xs" style={{ color: colors.mutedForeground }}>{brand.primaryFont}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div>
            <h3 className="font-semibold" style={{ color: colors.foreground }}>Set up your Brand Kit</h3>
            <p className="text-sm" style={{ color: colors.mutedForeground }}>
              Import your website once — your logo, colours, fonts and brand details are used for every poster and video.
            </p>
          </div>
        )}
      </Link>
    </div>
  );
}
