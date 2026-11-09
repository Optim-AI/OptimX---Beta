import { authFetch } from '@/lib/utils';

/** Ask the server for the Facebook Login for Business URL and go there. Returns an error message on failure. */
export async function startMetaConnect(): Promise<string | null> {
  try {
    const res = await authFetch('/api/meta-intel/connect', { method: 'POST' });
    const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
    if (res.status === 401) return 'Please log in again, then try connecting.';
    if (!res.ok || !data.url) return data.message || 'Could not start the Meta connection. Please try again.';
    window.location.href = data.url;
    return null;
  } catch {
    return 'Could not reach SkalX. Check your internet and try again.';
  }
}
