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
  // Middleware clones request bodies (default 10MB). Video session PUTs can
  // exceed that when brand images / inline media are included; match the
  // pages/api/creative-studio/sessions bodyParser sizeLimit (50mb).
  experimental: {
    middlewareClientMaxBodySize: '50mb',
  },
  serverExternalPackages: ['playwright', 'ffmpeg-static', 'sharp'],
  // ffmpeg-static downloads its binary in a postinstall script. That file is
  // not a static import, so Next file tracing omits it and the Vercel function
  // spawns /var/task/node_modules/ffmpeg-static/ffmpeg (ENOENT) during voiceover mux.
  outputFileTracingIncludes: {
    '/api/commercial/generate': ['./node_modules/ffmpeg-static/ffmpeg'],
    // Template posters fall back to this font when a brand font can't be fetched
    // (read from disk at runtime, so tracing can't see it). Poster generation is
    // reachable from several API routes, so include it for all of them.
    '/api/**/*': ['./node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf'],
  },
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
