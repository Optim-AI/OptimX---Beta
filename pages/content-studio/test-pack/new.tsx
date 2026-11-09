// Old entry point for test packs: the new poster flow replaces it (keeps ?from_ad).
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function TestPackNewRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const fromAd = typeof router.query.from_ad === 'string' ? router.query.from_ad : null;
    router.replace(`/content-studio/posters/new${fromAd ? `?from_ad=${encodeURIComponent(fromAd)}` : ''}`);
  }, [router]);
  return null;
}
