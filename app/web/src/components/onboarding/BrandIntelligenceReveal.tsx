'use client';

import React from 'react';
import { Check } from 'lucide-react';
import {
  buildBrandInsightCards,
  type BrandInsightCard,
} from '@/lib/onboarding/brand-insights';
import type {
  BrandSnapshot,
  Product,
} from '@/app/web/src/components/creative-studio/types';
import type { BrandResearch } from '@/lib/research/brand-research';
import {
  BrandResearchHighlights,
  ResearchPending,
} from '@/app/web/src/components/research/BrandResearchReport';

import { DrawnCheck, Enter } from './ob-ui';

const FLOW_STEPS = [
  { n: '01', title: 'Your brand', body: 'Logo, product, visual language' },
  { n: '02', title: 'Creative direction', body: 'Themes, composition, messaging' },
  { n: '03', title: 'Your campaign creatives', body: 'Personalized variations for your brand' },
];

type Props = {
  brand: BrandSnapshot | null;
  brandName: string;
  products: Product[];
  selectedProduct: Product | null;
  onSelectProduct: (product: Product) => void;
  onContinue: () => void;
  continueError?: string | null;
  catalogLoading?: boolean;
  research?: BrandResearch | null;
  researchPending?: boolean;
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
  research,
  researchPending,
}: Props) {
  const cards = buildBrandInsightCards(brand, brandName);

  const needsProductPick = products.length > 0;
  const canContinue = !needsProductPick || Boolean(selectedProduct);

  return (
    <div className="mx-auto mt-10 max-w-3xl sm:mt-16">
      <Enter>
        <h1 className="mb-3 font-display text-3xl font-semibold leading-[1.1] tracking-[-0.025em] sm:text-[2.6rem]">
          Here&apos;s what we <span className="ob-gradient-text">picked up.</span>
        </h1>
      </Enter>
      <Enter delay={90}>
        <p className="mb-10 text-paper/65">
          From your website and what the market says about it. Pick a product — we&apos;ll shape creatives around it.
        </p>
      </Enter>

      {cards.length === 0 ? (
        <Enter delay={160} className="ob-glass mb-8 rounded-3xl p-6 sm:p-8">
          <p className="text-paper/65">
            Brand saved as <strong className="text-paper">{brandName || 'your brand'}</strong>.
            You can refine details later in Brand Studio.
          </p>
        </Enter>
      ) : (
        <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card: BrandInsightCard, index) => (
            <div
              key={card.id}
              className={`ob-enter ob-glass ob-card group relative overflow-hidden rounded-3xl p-5 ${
                card.id === 'creative' && cards.length % 2 === 1 ? 'sm:col-span-2' : ''
              }`}
              style={{ '--d': `${160 + index * 110}ms` } as React.CSSProperties}
            >
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-paper/60">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent-on-ink" />
                {card.label}
              </div>
              <div className="relative text-lg leading-snug text-paper">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {research ? (
        <Enter delay={240} className="mb-10">
          <BrandResearchHighlights research={research} />
        </Enter>
      ) : researchPending ? (
        <Enter delay={240} className="mb-10">
          <ResearchPending label="Researching your competitors and customers" />
        </Enter>
      ) : null}

      {(catalogLoading || products.length > 0) && (
        <Enter delay={280} className="mb-10">
          <h2 className="mb-2 font-display text-xl font-semibold tracking-[-0.015em]">Choose a product</h2>
          <p className="mb-5 text-sm text-paper/65">
            We&apos;ll use this product as the hero of your creatives — packaging, category, and
            visual world.
          </p>
          {catalogLoading && products.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <p className="col-span-full text-sm text-paper/65">Finding products on your site…</p>
              {[0, 1, 2].map((i) => (
                <div key={i} aria-hidden className="ob-shimmer aspect-square rounded-3xl border border-paper/[0.06] bg-paper/[0.03]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                    className={`ob-glass ob-card group overflow-hidden rounded-3xl text-left ${selected ? 'ob-selected' : ''}`}
                  >
                    <div className="relative w-full bg-black/30" style={{ aspectRatio: '1 / 1' }}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumb}
                          alt={product.product_name}
                          className="absolute inset-0 h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-paper/60">
                          No image
                        </div>
                      )}
                      {selected && <DrawnCheck className="absolute right-2.5 top-2.5" />}
                    </div>
                    <div className="p-3">
                      <div className="line-clamp-2 text-sm font-medium">{product.product_name}</div>
                      {(product.category || product.short_benefit) && (
                        <div className="mt-1 line-clamp-2 text-xs text-paper/60">
                          {product.category || product.short_benefit}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Enter>
      )}

      <Enter delay={320} className="mb-10">
        <p className="mb-5 text-base text-paper">Now we&apos;ll turn this into creative.</p>
        <ol className="relative grid grid-cols-1 gap-4 sm:grid-cols-3">
          
          {FLOW_STEPS.map((step) => (
            <li key={step.n} className="ob-glass relative rounded-2xl p-4">
              <div className="mb-3 flex items-center gap-3 font-display text-sm font-semibold tabular-nums text-accent-on-ink">
                {step.n}
                <span aria-hidden className="h-px flex-1 bg-paper/15" />
              </div>
              <div className="mb-1 text-sm font-medium">{step.title}</div>
              <div className="text-xs text-paper/60">{step.body}</div>
            </li>
          ))}
        </ol>
      </Enter>

      {continueError && (
        <p className="mb-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-[hsl(0_84%_72%)]" role="alert">
          {continueError}
        </p>
      )}

      <Enter delay={380}>
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="ob-btn h-12 w-full min-w-[200px] rounded-full px-8 font-medium disabled:opacity-50 sm:w-auto"
        >
          Continue
        </button>
      </Enter>
    </div>
  );
}
