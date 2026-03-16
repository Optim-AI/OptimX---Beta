
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
 * Safely parse JSON from a Response. When the response is HTML (e.g. error pages),
 * response.json() throws. This helper avoids that and returns a fallback.
 */
export async function safeResponseJson<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    const msg = !response.ok
      ? `Server error (${response.status}). Please try again.`
      : 'Invalid response from server.';
    throw new Error(msg);
  }
}

/**
 * Authenticated fetch wrapper - automatically includes auth token
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const existingHeaders: Record<string, string> = {};
  if (options.headers) {
    const h = options.headers instanceof Headers
      ? options.headers
      : new Headers(options.headers as Record<string, string>);
    h.forEach((value, key) => { existingHeaders[key] = value; });
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...existingHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, {
    ...options,
    headers,
  });
}
