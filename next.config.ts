/** @type {import('next').NextConfig} */
const nextConfig = {
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
