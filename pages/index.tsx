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
const ParallaxBackground = dynamic(
  () => import("../app/web/src/components/ParallaxBackground"),
  { ssr: false }
);
const Hero = dynamic(() => import("../app/web/src/components/Hero"), {
  ssr: false,
  loading: HeroSkeleton,
});
const CreativeShowcase = dynamic(
  () => import("../app/web/src/components/CreativeShowcase"),
  { ssr: false }
);
const HowCreditsWork = dynamic(() => import("../app/web/src/components/HowCreditsWork"), {
  ssr: false,
});
const ProductSection = dynamic(() => import("../app/web/src/components/ProductSection"), {
  ssr: false,
});
const BuiltFor = dynamic(() => import("../app/web/src/components/BuiltFor"), { ssr: false });
const AboutPreview = dynamic(() => import("../app/web/src/components/AboutPreview"), {
  ssr: false,
});
const FAQ = dynamic(() => import("../app/web/src/components/FAQ"), { ssr: false });
const FinalCTA = dynamic(() => import("../app/web/src/components/FinalCTA"), { ssr: false });
const Footer = dynamic(() => import("../app/web/src/components/Footer"), { ssr: false });

/**
 * Public marketing homepage.
 * Authenticated users stay on the marketing page; Try Now / Login handle routing.
 * (Previously auto-redirected to /welcome or /content-studio.)
 */
const Home: React.FC = () => {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#121212" }}>
      <ParallaxBackground />
      <Header />
      <main className="relative z-10">
        <Hero />
        <CreativeShowcase />
        <HowCreditsWork />
        <ProductSection />
        <BuiltFor />
        <AboutPreview />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Home;
