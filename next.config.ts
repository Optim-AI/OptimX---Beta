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
  serverExternalPackages: ['playwright'],
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('playwright');
    }
    return config;
  },
  experimental: {
    // Ensures pages/api works in production when app/ also exists
    manualClientBasePath: true,
    optimizePackageImports: ['react', 'next'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
