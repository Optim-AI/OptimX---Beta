
'use client';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines multiple class names conditionally and merges Tailwind classes safely.
 * 
 * Example:
 * ```tsx
 * <div className={cn('p-2', isActive && 'bg-primary', 'text-white')} />
 * ```
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
