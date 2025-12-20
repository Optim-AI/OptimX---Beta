'use client';

import * as React from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    // Bail out early during SSR or if window is undefined
    if (typeof window === 'undefined') return;

    const checkIsMobile = () => window.innerWidth < MOBILE_BREAKPOINT;

    const handleChange = () => setIsMobile(checkIsMobile());

    // Initial check
    setIsMobile(checkIsMobile());

    // Set up listener
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  return isMobile;
}
