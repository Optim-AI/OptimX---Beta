'use client';

import React from 'react';
import { useFeatures, FeatureKey } from '@/app/web/src/hooks/use-features';
import { ComingSoonOverlay } from './ComingSoonOverlay';

interface FeatureGateProps {
  featureKey: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showComingSoon?: boolean;
}

/**
 * FeatureGate component for controlling access to features based on plan
 * 
 * @param featureKey - The feature key to check access for
 * @param children - Content to render if feature is enabled
 * @param fallback - Optional fallback content if feature is disabled
 * @param showComingSoon - If true, shows ComingSoonOverlay for coming_soon features
 */
export function FeatureGate({ 
  featureKey, 
  children, 
  fallback,
  showComingSoon = true,
}: FeatureGateProps) {
  const checkFeature = useFeatures((state) => state.checkFeature);
  const access = checkFeature(featureKey);

  // Feature is enabled - show content
  if (access.enabled) {
    return <>{children}</>;
  }

  // Feature is coming soon - show blurred content with overlay
  if (access.comingSoon && showComingSoon) {
    return (
      <ComingSoonOverlay featureKey={featureKey}>
        {children}
      </ComingSoonOverlay>
    );
  }

  // Feature is disabled - show fallback or nothing
  return fallback ? <>{fallback}</> : null;
}

/**
 * Hook version of FeatureGate for programmatic access
 */
export function useFeatureGate(featureKey: FeatureKey) {
  const checkFeature = useFeatures((state) => state.checkFeature);
  return checkFeature(featureKey);
}

/**
 * HOC version of FeatureGate
 */
export function withFeatureGate<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  featureKey: FeatureKey,
  fallback?: React.ReactNode
) {
  return function FeatureGatedComponent(props: P) {
    return (
      <FeatureGate featureKey={featureKey} fallback={fallback}>
        <WrappedComponent {...props} />
      </FeatureGate>
    );
  };
}
