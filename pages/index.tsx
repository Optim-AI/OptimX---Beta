// pages/index.tsx
import React from "react";
import dynamic from "next/dynamic";
import { HeaderSkeleton, HeroSkeleton } from "@/app/web/src/components/landing-skeletons";

/**
 * Dynamically import client-only components so Next.js DOES NOT try to run their
 * hooks during server prerender.
 */

const Header = dynamic(() => import("../app/web/src/components/Header"), {
  ssr: false,
  loading: HeaderSkeleton,
});
const Hero = dynamic(() => import("../app/web/src/components/Hero"), {
  ssr: false,
  loading: HeroSkeleton,
});
const BrandJourney = dynamic(() => import("../app/web/src/components/BrandJourney"), {
  ssr: false,
});
const CreativeShowcase = dynamic(
  () => import("../app/web/src/components/CreativeShowcase"),
  { ssr: false }
);
const HowItWorks = dynamic(() => import("../app/web/src/components/HowItWorks"), {
  ssr: false,
});
const FinalCTA = dynamic(() => import("../app/web/src/components/FinalCTA"), { ssr: false });
const Footer = dynamic(() => import("../app/web/src/components/Footer"), { ssr: false });

/**
 * Public marketing homepage — compact, product-led.
 * Guest onboarding entry remains /try via Hero and Final CTA.
 */
const Home: React.FC = () => {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#121212" }}>
      <Header />
      <main className="relative z-10">
        <Hero />
        <BrandJourney />
        <CreativeShowcase />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
