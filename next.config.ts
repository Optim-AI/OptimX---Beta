/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/signin', destination: '/auth/signin', permanent: true },
      { source: '/refund-cancellation', destination: '/terms-and-conditions', permanent: true },
      { source: '/cookie-policy', destination: '/cpolicy', permanent: true },
      { source: '/cookiepolicy', destination: '/cpolicy', permanent: true },
    ];
  },
  serverExternalPackages: ['playwright', 'ffmpeg-static', 'sharp'],
  webpack: (config: any, { isServer }: { isServer: boolean; dev: boolean }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('playwright');
    }
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  compress: true,
  async headers() {
    // Security headers apply in all environments.
    const securityHeaders = {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    };

    // In development, DO NOT send long-lived/immutable cache headers for
    // `/_next/static/*`. Dev bundle URLs are not content-hashed the same way,
    // so `immutable` makes the browser keep a stale webpack runtime chunk after
    // a server restart. Its baked-in __webpack_hash__ then never matches the
    // server's compilation hash, so isUpdateAvailable() stays true and Fast
    // Refresh full-reloads in an inescapable loop (the chunk is "cached
    // forever"). Only apply aggressive immutable caching in production.
    if (process.env.NODE_ENV !== 'production') {
      return [securityHeaders];
    }

    const immutable = { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' };
    return [
      securityHeaders,
      { source: '/images/:path*', headers: [immutable] },
      { source: '/videos/:path*', headers: [immutable] },
      { source: '/_next/static/:path*', headers: [immutable] },
    ];
  },
};

export default nextConfig;
