'use client';

import React, { useState } from 'react';
import colors from '@/lib/ui/colors';
import type { BrandSnapshot, Product } from '@/app/web/src/components/creative-studio/types';

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
} as const;

type Props = {
  brand: BrandSnapshot | null;
  brandName: string;
  websiteUrl?: string;
  products: Product[];
  selectedProduct: Product | null;
  onSelectProduct: (product: Product) => void;
  onChangeBrand: (next: BrandSnapshot) => void;
  onContinue: () => void;
  continueError?: string | null;
  continuing?: boolean;
};

function Swatch({ hex }: { hex: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 h-8 rounded-lg border border-white/10" style={{ background: hex }} />
      <span className="text-sm font-mono" style={{ color: colors.mutedForeground }}>{hex}</span>
    </div>
  );
}

export default function BrandDnaReveal({
  brand,
  brandName,
  websiteUrl,
  products,
  selectedProduct,
  onSelectProduct,
  onChangeBrand,
  onContinue,
  continueError,
  continuing,
}: Props) {
  const [editing, setEditing] = useState(false);
  const name = brand?.name || brandName;
  const colorsList = [
    brand?.colors?.primary,
    brand?.colors?.secondary,
    brand?.colors?.accent,
    ...(brand?.primaryColors || []),
  ].filter((c, i, arr): c is string => Boolean(c) && arr.indexOf(c) === i);

  const tone = brand?.brand_tone?.filter(Boolean).join(' · ') || brand?.tone || '';
  const personality = brand?.personality || '';
  const aesthetic = brand?.brand_aesthetic?.filter(Boolean) || [];

  return (
    <div className="max-w-5xl mx-auto mt-6 sm:mt-10 pb-8">
      <p className="text-xs uppercase tracking-[0.18em] mb-3" style={{ color: colors.primary }}>
        Brand DNA
      </p>
      <h1 className="text-3xl sm:text-5xl font-normal mb-3">{name || 'Your brand'}</h1>
      <p className="mb-8 max-w-2xl font-light" style={{ color: colors.mutedForeground }}>
        This profile is built from what SkalX extracted. Empty sections are left out.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-2xl p-5 sm:p-6" style={glass}>
          <h2 className="text-sm uppercase tracking-[0.14em] mb-4" style={{ color: colors.mutedForeground }}>
            Brand identity
          </h2>
          <div className="flex items-start gap-4">
            {brand?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo} alt="" className="w-16 h-16 object-contain rounded-lg bg-black/30" />
            ) : null}
            <div className="min-w-0 flex-1 space-y-2">
              {editing ? (
                <input
                  value={brand?.name || ''}
                  onChange={(e) => brand && onChangeBrand({ ...brand, name: e.target.value })}
                  className="w-full h-10 rounded-lg px-3"
                  style={{ background: '#0c0c0c', color: colors.foreground, border: `1px solid ${colors.border}` }}
                />
              ) : (
                <div className="text-xl">{name}</div>
              )}
              {websiteUrl || brand?.website_url ? (
                <div className="text-sm truncate" style={{ color: colors.mutedForeground }}>
                  {websiteUrl || brand?.website_url}
                </div>
              ) : null}
            </div>
          </div>
          {(brand?.business_overview || brand?.description || editing) && (
            <div className="mt-4">
              {editing ? (
                <textarea
                  value={brand?.description || ''}
                  onChange={(e) => brand && onChangeBrand({ ...brand, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ background: '#0c0c0c', color: colors.foreground, border: `1px solid ${colors.border}` }}
                />
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                  {brand?.business_overview || brand?.description}
                </p>
              )}
            </div>
          )}
          {brand && (
            <button
              type="button"
              className="mt-4 text-sm"
              style={{ color: colors.primary, background: 'transparent', border: 'none', padding: 0 }}
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Done editing' : 'Edit identity'}
            </button>
          )}
        </section>

        {(colorsList.length > 0 || brand?.primaryFont || brand?.fontStyles || aesthetic.length > 0) && (
          <section className="rounded-2xl p-5 sm:p-6" style={glass}>
            <h2 className="text-sm uppercase tracking-[0.14em] mb-4" style={{ color: colors.mutedForeground }}>
              Visual identity
            </h2>
            {colorsList.length > 0 && (
              <div className="flex flex-wrap gap-4 mb-4">
                {colorsList.slice(0, 5).map((hex) => (
                  <Swatch key={hex} hex={hex} />
                ))}
              </div>
            )}
            {(brand?.primaryFont || brand?.fontStyles) && (
              <p className="text-sm mb-2" style={{ color: colors.foreground }}>
                <span style={{ color: colors.mutedForeground }}>Type · </span>
                {brand.primaryFont || brand.fontStyles}
              </p>
            )}
            {aesthetic.length > 0 && (
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                {aesthetic.slice(0, 6).join(' · ')}
              </p>
            )}
          </section>
        )}

        {(tone || personality || brand?.tagline || brand?.brand_values?.length) && (
          <section className="rounded-2xl p-5 sm:p-6" style={glass}>
            <h2 className="text-sm uppercase tracking-[0.14em] mb-4" style={{ color: colors.mutedForeground }}>
              Brand voice
            </h2>
            {brand?.tagline && <p className="text-lg mb-3">{brand.tagline}</p>}
            {editing && brand && (
              <input
                value={brand.tagline || ''}
                placeholder="Tagline"
                onChange={(e) => onChangeBrand({ ...brand, tagline: e.target.value })}
                className="w-full h-10 rounded-lg px-3 mb-3 text-sm"
                style={{ background: '#0c0c0c', color: colors.foreground, border: `1px solid ${colors.border}` }}
              />
            )}
            {tone && <p className="text-sm mb-2" style={{ color: colors.mutedForeground }}>Tone · {tone}</p>}
            {personality && (
              <p className="text-sm mb-2" style={{ color: colors.mutedForeground }}>Personality · {personality}</p>
            )}
            {brand?.brand_values && brand.brand_values.length > 0 && (
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                {brand.brand_values.slice(0, 6).join(' · ')}
              </p>
            )}
          </section>
        )}

        {(brand?.audience || brand?.coreValueProp || brand?.offering) && (
          <section className="rounded-2xl p-5 sm:p-6" style={glass}>
            <h2 className="text-sm uppercase tracking-[0.14em] mb-4" style={{ color: colors.mutedForeground }}>
              Creative intelligence
            </h2>
            {brand?.audience && (
              <p className="text-sm mb-2" style={{ color: colors.mutedForeground }}>Audience · {brand.audience}</p>
            )}
            {brand?.coreValueProp && (
              <p className="text-sm mb-2" style={{ color: colors.foreground }}>{brand.coreValueProp}</p>
            )}
            {brand?.offering && (
              <p className="text-sm" style={{ color: colors.mutedForeground }}>Offering · {brand.offering}</p>
            )}
          </section>
        )}

        {brand?.marketSummary && (
          <section className="rounded-2xl p-5 sm:p-6 lg:col-span-2" style={glass}>
            <h2 className="text-sm uppercase tracking-[0.14em] mb-3" style={{ color: colors.mutedForeground }}>
              Market notes
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>{brand.marketSummary}</p>
          </section>
        )}
      </div>

      {products.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-normal mb-2">Products</h2>
          <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
            The selected product is the default for your first creative.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.slice(0, 12).map((product, index) => {
              const thumb = product.product_images?.[0];
              const selected =
                selectedProduct?.product_name === product.product_name &&
                selectedProduct?.product_images?.[0] === product.product_images?.[0];
              return (
                <button
                  key={`${product.product_name}-${index}`}
                  type="button"
                  onClick={() => onSelectProduct(product)}
                  className="text-left rounded-2xl overflow-hidden"
                  style={{ ...glass, outline: selected ? `2px solid ${colors.primary}` : '2px solid transparent' }}
                >
                  <div className="relative w-full bg-black/30" style={{ aspectRatio: '1 / 1' }}>
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-contain p-2" />
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-medium line-clamp-2">{product.product_name}</div>
                    {product.short_benefit && (
                      <div className="text-xs mt-1 line-clamp-2" style={{ color: colors.mutedForeground }}>
                        {product.short_benefit}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {continueError && (
        <p className="mt-6 text-sm" role="alert" style={{ color: 'hsl(0 84% 60%)' }}>{continueError}</p>
      )}

      <div className="mt-8">
        <button
          type="button"
          onClick={onContinue}
          disabled={continuing}
          className="h-12 px-8 rounded-xl font-medium disabled:opacity-60"
          style={{ background: colors.gradientPrimary, color: colors.primaryForeground, border: 'none' }}
        >
          {continuing ? 'Starting…' : 'Create my first creatives →'}
        </button>
      </div>
    </div>
  );
}
