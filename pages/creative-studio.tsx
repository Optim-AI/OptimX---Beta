// pages/creative-studio.tsx
// Redirect to Brand Studio (renamed from Creative Studio)

import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function CreativeStudioRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/brand-studio');
  }, [router]);

  return null;
}
