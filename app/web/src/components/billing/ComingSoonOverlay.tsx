'use client';

import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/app/web/src/components/ui/button';
import { FeatureKey } from '@/app/web/src/hooks/use-features';

interface ComingSoonOverlayProps {
  children: React.ReactNode;
  featureKey?: FeatureKey;
  title?: string;
  description?: string;
  onUpgradeClick?: () => void;
}

const FEATURE_NAMES: Record<FeatureKey, string> = {
  image_generation: 'Image Generation',
  video_generation: 'Video Generation',
  no_watermark: 'Watermark-Free Exports',
  fast_generation: 'Fast Generation',
  priority_generation: 'Priority Processing',
  basic_analytics: 'Analytics',
  advanced_analytics: 'Advanced Analytics',
  social_posting: 'Social Posting',
  auto_scheduling: 'Auto Scheduling',
  brand_analysis: 'Brand Analysis',
  competitive_analysis: 'Competitive Analysis',
  dashboard: 'Dashboard',
  integrations: 'Integrations',
  create_campaigns: 'Campaign Creation',
  campaign_library: 'Campaign Library',
};

/**
 * ComingSoonOverlay component
 * Displays a blurred version of content with a "Coming Soon" overlay
 */
export function ComingSoonOverlay({
  children,
  featureKey,
  title,
  description,
  onUpgradeClick,
}: ComingSoonOverlayProps) {
  const featureName = featureKey ? FEATURE_NAMES[featureKey] : 'This feature';
  const displayTitle = title || `${featureName} Coming Soon`;
  const displayDescription = description || 
    `We're working hard to bring you ${featureName.toLowerCase()}. Stay tuned for updates!`;

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {/* Blurred content */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="blur-sm opacity-50 pointer-events-none select-none">
          {children}
        </div>
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
        <div className="max-w-md mx-auto p-8 text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground mb-3">
            {displayTitle}
          </h2>

          {/* Description */}
          <p className="text-muted-foreground mb-6">
            {displayDescription}
          </p>

          {/* CTA Button */}
          <Button
            size="lg"
            className="gap-2"
            disabled
            onClick={onUpgradeClick}
          >
            <Lock className="w-4 h-4" />
            Coming Soon
          </Button>

          {/* Additional info */}
          <p className="text-xs text-muted-foreground mt-4">
            This feature will be available in an upcoming update.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Smaller inline version for cards/sections
 */
export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium 
      bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 
      rounded-full ${className || ''}`}>
      <Sparkles className="w-3 h-3" />
      Coming Soon
    </span>
  );
}
