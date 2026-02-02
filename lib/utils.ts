
'use client';

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from '@/auth/supabase/client';

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

/**
 * Get the current user's access token for API calls
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return data?.session?.access_token ?? null;
  } catch (e) {
    return null;
  }
}

/**
 * Get headers for authenticated API calls
 */
export async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Authenticated fetch wrapper - automatically includes auth token
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    headers,
  });
}
