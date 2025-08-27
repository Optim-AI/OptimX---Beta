// apps/web/src/components/Hero.tsx
import React from 'react';
import Link from 'next/link';

export const Hero: React.FC = () => (
  <section className="bg-white py-20">
    <div className="container mx-auto px-6 text-center">
      <h1 className="text-4xl font-bold mb-4">
        Your Marketing Agency, <span className="text-blue-500">AI-Powered</span>
      </h1>
      <p className="text-gray-600 mb-8">
        Plan, create, and launch marketing campaigns across Meta, Google, WhatsApp, and ONDC—all from one dashboard.
      </p>
      <div className="flex justify-center gap-4 mb-12">
        <Link href="/signup">
          <a className="bg-blue-500 text-white px-6 py-3 rounded-md hover:bg-blue-600 transition">
            Start Free Trial
          </a>
        </Link>
        <Link href="/demo">
          <a className="border border-gray-300 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-100 transition">
            Watch Demo
          </a>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border rounded-md shadow-sm">
          <h3 className="font-semibold mb-2">AI Campaign Creation</h3>
          <p>Generate compelling content, visuals, and targeting strategies in minutes.</p>
        </div>
        <div className="p-6 border rounded-md shadow-sm">
          <h3 className="font-semibold mb-2">Cross-Platform Analytics</h3>
          <p>Track ROI, ROAS, and performance across all platforms in real-time.</p>
        </div>
        <div className="p-6 border rounded-md shadow-sm">
          <h3 className="font-semibold mb-2">One-Click Publishing</h3>
          <p>Launch campaigns across Meta, Google, ONDC, and WhatsApp simultaneously.</p>
        </div>
      </div>
    </div>
  </section>
);
