import React from 'react';
export const Hero = () => (
  <header className="bg-blue-50 py-8">
    <nav className="container mx-auto flex justify-between items-center">
      <div className="text-2xl font-bold">OptimAI</div>
      <div>
        <button className="mr-4">Sign in</button>
        <button className="bg-blue-500 text-white px-4 py-2 rounded">Get Started</button>
      </div>
    </nav>
    <div className="container mx-auto text-center py-16">
      <h1 className="text-5xl font-bold">Your Marketing Agency, AI-Powered</h1>
      <p className="text-xl mt-4">Plan, create, and launch marketing campaigns across Meta, Google, WhatsApp, and ONDC from one dashboard. No agency needed.</p>
      <div className="mt-8">
        <button className="bg-blue-600 text-white px-6 py-3 rounded mr-4">Start Free Trial</button>
        <button className="border border-blue-600 text-blue-600 px-6 py-3 rounded">Watch Demo</button>
      </div>
      <h2 className="text-3xl font-bold mt-16">Everything you need to grow your business</h2>
      <p className="text-lg mt-4">Replace expensive agencies with AI that works 24/7</p>
      <div className="grid grid-cols-3 gap-8 mt-8">
        <div className="bg-white p-6 rounded shadow">
          <div className="text-blue-500 text-4xl mb-4">⚙️</div>
          <h3 className="text-xl font-bold">AI Campaign Creation</h3>
          <p>Generate compelling content, visuals, and targeting strategies in minutes.</p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <div className="text-blue-500 text-4xl mb-4">📊</div>
          <h3 className="text-xl font-bold">Cross-Platform Analytics</h3>
          <p>Track ROI, ROAS, and performance across all platforms in real-time.</p>
        </div>
        <div className="bg-white p-6 rounded shadow">
          <div className="text-blue-500 text-4xl mb-4">🚀</div>
          <h3 className="text-xl font-bold">One-Click Publishing</h3>
          <p>Launch campaigns across Meta, Google, ONDC, and WhatsApp simultaneously.</p>
        </div>
      </div>
    </div>
  </header>
);