'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import colors from '@/lib/ui/colors';
import {
  buildBrandInsightCards,
  type BrandInsightCard,
} from '@/lib/onboarding/brand-insights';
import type {
  BrandSnapshot,
  Product,
} from '@/app/web/src/components/creative-studio/types';

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
} as const;

type Props = {
  brand: BrandSnapshot | null;
  brandName: string;
  products: Product[];
  selectedProduct: Product | null;
  onSelectProduct: (product: Product) => void;
  onContinue: () => void;
  continueError?: string | null;
  catalogLoading?: boolean;
};

export default function BrandIntelligenceReveal({
  brand,
  brandName,
  products,
  selectedProduct,
  onSelectProduct,
  onContinue,
  continueError,
  catalogLoading,
}: Props) {
  const cards = buildBrandInsightCards(brand, brandName);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    if (cards.length === 0) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= cards.length) window.clearInterval(id);
    }, 140);
    return () => window.clearInterval(id);
  }, [cards.length, brand?.name]);

  const needsProductPick = products.length > 0;
  const canContinue = !needsProductPick || Boolean(selectedProduct);

  return (
    <div className="max-w-3xl mx-auto mt-10 sm:mt-16">
      <h1 className="text-3xl sm:text-4xl font-normal mb-3">
        Here&apos;s what we picked up.
      </h1>
      <p className="mb-10 font-light" style={{ color: colors.mutedForeground }}>
        Your brand has a clear visual language. Pick a product — we&apos;ll shape creatives around it.
      </p>

      {cards.length === 0 ? (
        <div className="rounded-2xl p-6 sm:p-8 mb-8" style={glass}>
          <p style={{ color: colors.mutedForeground }}>
            Brand saved as{' '}
            <strong style={{ color: colors.foreground }}>{brandName || 'your brand'}</strong>.
            You can refine details later in Brand Studio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {cards.map((card: BrandInsightCard, index) => (
            <div
              key={card.id}
              className="rounded-2xl p-5 transition-all duration-500"
              style={{
                ...glass,
                opacity: index < visibleCount ? 1 : 0,
                transform: index < visibleCount ? 'translateY(0)' : 'translateY(12px)',
                gridColumn:
                  card.id === 'creative' && cards.length % 2 === 1
                    ? '1 / -1'
                    : undefined,
              }}
            >
              <div
                className="text-xs uppercase tracking-[0.15em] mb-2"
                style={{ color: colors.mutedForeground }}
              >
                {card.label}
              </div>
              <div className="text-lg leading-snug" style={{ color: colors.foreground }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {(catalogLoading || products.length > 0) && (
        <div className="mb-10">
          <h2 className="text-xl font-normal mb-2">Choose a product</h2>
          <p className="text-sm mb-5" style={{ color: colors.mutedForeground }}>
            We&apos;ll use this product as the hero of your creatives — packaging, category, and
            visual world.
          </p>
          {catalogLoading && products.length === 0 ? (
            <p className="text-sm" style={{ color: colors.mutedForeground }}>
              Finding products on your site…
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {products.map((product, index) => {
                const thumb = product.product_images?.[0];
                const selected =
                  selectedProduct?.product_name === product.product_name &&
                  selectedProduct?.product_images?.[0] === product.product_images?.[0];
                return (
                  <button
                    key={`${product.product_name}-${index}`}
                    type="button"
                    onClick={() => onSelectProduct(product)}
                    className="text-left rounded-2xl overflow-hidden transition-transform hover:-translate-y-0.5"
                    style={{
                      ...glass,
                      outline: selected
                        ? `2px solid ${colors.primary}`
                        : '2px solid transparent',
                    }}
                  >
                    <div
                      className="relative w-full bg-black/30"
                      style={{ aspectRatio: '1 / 1' }}
                    >
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={product.product_name}
                          className="absolute inset-0 w-full h-full object-contain p-2"
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex items-center justify-center text-xs"
                          style={{ color: colors.mutedForeground }}
                        >
                          No image
                        </div>
                      )}
                      {selected && (
                        <span
                          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: colors.primary }}
                        >
                          <Check className="h-3.5 w-3.5 text-white" />
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-medium line-clamp-2">
                        {product.product_name}
                      </div>
                      {(product.category || product.short_benefit) && (
                        <div
                          className="text-xs mt-1 line-clamp-2"
                          style={{ color: colors.mutedForeground }}
                        >
                          {product.category || product.short_benefit}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mb-10">
        <p className="text-base mb-5" style={{ color: colors.foreground }}>
          Now we&apos;ll turn this into creative.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              n: '01',
              title: 'Your brand',
              body: 'Logo, product, visual language',
            },
            {
              n: '02',
              title: 'Creative direction',
              body: 'Themes, composition, messaging',
            },
            {
              n: '03',
              title: 'Your campaign creatives',
              body: 'Personalized variations for your brand',
            },
          ].map((step) => (
            <div key={step.n} className="rounded-xl p-4" style={glass}>
              <div
                className="text-xs font-medium mb-2"
                style={{ color: colors.primary }}
              >
                {step.n}
              </div>
              <div className="text-sm font-medium mb-1">{step.title}</div>
              <div className="text-xs" style={{ color: colors.mutedForeground }}>
                {step.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      {continueError && (
        <p className="mb-4 text-sm" role="alert" style={{ color: 'hsl(0 84% 60%)' }}>
          {continueError}
        </p>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={!canContinue}
        className="w-full sm:w-auto min-w-[200px] h-12 px-8 rounded-xl font-medium disabled:opacity-50"
        style={{
          background: colors.gradientPrimary,
          color: colors.primaryForeground,
          border: 'none',
        }}
      >
        Continue
      </button>
    </div>
  );
}
