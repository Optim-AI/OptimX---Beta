// pages/index.tsx
import React from "react";
import dynamic from "next/dynamic";
import "../styles/globals.css";

/**
 * Dynamically import client-only components so Next.js DOES NOT try to run their
 * hooks during server prerender. This avoids the "reading 'useRef' of null" error.
 *
 * If some components are pure server components, you can keep normal imports for those.
 */

const Header = dynamic(() => import("../app/web/src/components/Header"), { ssr: false });
const ParallaxBackground = dynamic(() => import("../app/web/src/components/ParallaxBackground"), { ssr: false });
const Hero = dynamic(() => import("../app/web/src/components/Hero"), { ssr: false });
const ComparisonSection = dynamic(() => import("../app/web/src/components/ComparisonSection"), { ssr: false });
const BuiltFor = dynamic(() => import("../app/web/src/components/BuiltFor"), { ssr: false });
const PricingPreview = dynamic(() => import("../app/web/src/components/PricingPreview"), { ssr: false });
const HowCreditsWork = dynamic(() => import("../app/web/src/components/HowCreditsWork"), { ssr: false });
const FAQ = dynamic(() => import("../app/web/src/components/FAQ"), { ssr: false });
const FinalCTA = dynamic(() => import("../app/web/src/components/FinalCTA"), { ssr: false });
const Footer = dynamic(() => import("../app/web/src/components/Footer"), { ssr: false });

const Home: React.FC = () => (
  <div className="min-h-screen relative" style={{ backgroundColor: '#121212' }}>
    <ParallaxBackground />
    <Header />
    <main className="relative z-10">
      <Hero />
      <ComparisonSection />
      <HowCreditsWork />
      <BuiltFor />
      <PricingPreview />
      <FAQ />
      <FinalCTA />
    </main>
    <Footer />
  </div>
);

export default Home;