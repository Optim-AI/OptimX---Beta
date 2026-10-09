// pages/index.tsx
import React from "react";
import dynamic from "next/dynamic";
import { HeaderSkeleton, HeroSkeleton } from "@/app/web/src/components/landing-skeletons";
import PageSeo from "@/components/seo/PageSeo";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_ORIGIN,
} from "@/lib/seo/site";

/**
 * Dynamically import client components.
 * Content sections use SSR so Google receives real titles, H1, and copy.
 * Parallax stays client-only (window/scroll dependent).
 */

const Header = dynamic(() => import("../app/web/src/components/Header"), {
  ssr: true,
  loading: HeaderSkeleton,
});
const Hero = dynamic(() => import("../app/web/src/components/Hero"), {
  ssr: true,
  loading: HeroSkeleton,
});
const BrandJourney = dynamic(() => import("../app/web/src/components/BrandJourney"), {
  ssr: false,
});
const CreativeShowcase = dynamic(
  () => import("../app/web/src/components/CreativeShowcase"),
  { ssr: true }
);
const HowCreditsWork = dynamic(() => import("../app/web/src/components/HowCreditsWork"), {
  ssr: true,
});
const ProductSection = dynamic(() => import("../app/web/src/components/ProductSection"), {
  ssr: true,
});
const BuiltFor = dynamic(() => import("../app/web/src/components/BuiltFor"), { ssr: true });
const AboutPreview = dynamic(() => import("../app/web/src/components/AboutPreview"), {
  ssr: true,
});
const FAQ = dynamic(() => import("../app/web/src/components/FAQ"), { ssr: true });
const FinalCTA = dynamic(() => import("../app/web/src/components/FinalCTA"), { ssr: false });
const Footer = dynamic(() => import("../app/web/src/components/Footer"), { ssr: true });

/**
 * Public marketing homepage.
 * Authenticated users stay on the marketing page; Try Now / Login handle routing.
 */
const Home: React.FC = () => {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#121212" }}>
      <PageSeo
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        path="/"
        includeSiteGraph
        jsonLd={{
          "@type": "WebPage",
          "@id": `${SITE_ORIGIN}/#webpage`,
          url: absoluteUrl("/"),
          name: DEFAULT_TITLE,
          description: DEFAULT_DESCRIPTION,
          isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
          about: { "@id": `${SITE_ORIGIN}/#organization` },
          inLanguage: "en",
        }}
      />
      <ParallaxBackground />
      <Header />
      <main className="relative z-10">
        <Hero />
        <BrandJourney />
        <CreativeShowcase />
        <HowItWorks />
        <FinalCTA />
      </main>
      <Footer />
      {/*
        Noscript fallback: homepage UI is JS-enhanced; ensure brand + product
        summary remains available when scripts are disabled.
      */}
      <noscript>
        <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto", color: "#fff" }}>
          <p>
            {SITE_NAME} is an AI marketing platform for ad creatives, poster generation, and
            short video ads. Visit {SITE_ORIGIN} with JavaScript enabled for the full experience.
          </p>
        </div>
      </noscript>
    </div>
  );
};

export default Home;
