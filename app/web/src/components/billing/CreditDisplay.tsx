'use client';

import React, { useEffect } from 'react';
import { Image, Video, Zap, RefreshCw } from 'lucide-react';
import { useSubscription, useIsSubscriptionStale } from '@/app/web/src/hooks/use-subscription';
import { cn } from '@/lib/utils';

interface CreditDisplayProps {
  variant?: 'full' | 'compact' | 'mini';
  showRefresh?: boolean;
  className?: string;
}

/**
 * CreditDisplay component shows current credit balances
 */
export function CreditDisplay({ 
  variant = 'compact', 
  showRefresh = false,
  className 
}: CreditDisplayProps) {
  const { credits, fetchSubscription, isLoading } = useSubscription();
  const isStale = useIsSubscriptionStale();

  // Fetch on mount if stale
  useEffect(() => {
    if (isStale) {
      fetchSubscription();
    }
  }, [isStale, fetchSubscription]);

  if (!credits) {
    return (
      <div className={cn('animate-pulse bg-muted rounded-lg h-8 w-24', className)} />
    );
  }

  if (variant === 'mini') {
    return (
      <div className={cn('flex items-center gap-2 text-sm', className)}>
        <span className="flex items-center gap-1">
          <Image className="w-4 h-4 text-blue-500" />
          {credits.imageCredits.total}
        </span>
        <span className="flex items-center gap-1">
          <Video className="w-4 h-4 text-purple-500" />
          {credits.videoCredits.total}s
        </span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-4 px-3 py-2 bg-muted/50 rounded-lg', className)}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
            <Image className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-sm">
            <span className="font-semibold">{credits.imageCredits.total}</span>
            <span className="text-muted-foreground ml-1">images</span>
          </div>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded">
            <Video className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-sm">
            <span className="font-semibold">{credits.videoCredits.total}</span>
            <span className="text-muted-foreground ml-1">sec</span>
          </div>
        </div>
        {showRefresh && (
          <button 
            onClick={() => fetchSubscription()}
            disabled={isLoading}
            className="ml-2 p-1 hover:bg-muted rounded"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={cn('space-y-4 p-4 bg-card border rounded-lg', className)}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Credits
        </h3>
        {showRefresh && (
          <button 
            onClick={() => fetchSubscription()}
            disabled={isLoading}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        )}
      </div>

      {/* Image Credits */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5 text-blue-500" />
            <span>Image Credits</span>
          </div>
          <span className="font-bold text-lg">{credits.imageCredits.total}</span>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>Subscription: {credits.imageCredits.subscription}</span>
          <span>•</span>
          <span>Bonus: {credits.imageCredits.addon}</span>
        </div>
      </div>

      {/* Video Credits */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-purple-500" />
            <span>Video Credits</span>
          </div>
          <span className="font-bold text-lg">{credits.videoCredits.total} sec</span>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span>Subscription: {credits.videoCredits.subscription}s</span>
          <span>•</span>
          <span>Bonus: {credits.videoCredits.addon}s</span>
        </div>
      </div>

      {/* Reset info */}
      {credits.lastResetAt && (
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Last reset: {new Date(credits.lastResetAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

/**
 * Low credit warning component
 */
export function LowCreditWarning({ 
  type, 
  threshold = 3 
}: { 
  type: 'image' | 'video'; 
  threshold?: number;
}) {
  const credits = useSubscription((state) => state.credits);

  if (!credits) return null;

  const balance = type === 'image' 
    ? credits.imageCredits.total 
    : credits.videoCredits.total;

  if (balance > threshold) return null;

  const label = type === 'image' ? 'image credits' : 'video seconds';

  return (
    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 
      border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
      <Zap className="w-4 h-4 text-amber-600" />
      <span className="text-amber-800 dark:text-amber-200">
        Low on {label}! Only <strong>{balance}</strong> remaining.
      </span>
    </div>
  );
}
