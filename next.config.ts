/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensures pages/api works in production when app/ also exists
    manualClientBasePath: true,
    legacyBrowsers: false,
    optimizePackageImports: ['react', 'next'],
  },
};

export default nextConfig;
