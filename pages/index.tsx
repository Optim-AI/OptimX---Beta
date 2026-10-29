// pages/index.tsx
import React from "react";
import PageSeo from "@/components/seo/PageSeo";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  SITE_NAME,
  SITE_ORIGIN,
} from "@/lib/seo/site";
import MarketingLayout from "@/app/web/src/components/marketing/MarketingLayout";
import HeroSection from "@/app/web/src/components/marketing/HeroSection";
import ProblemSection from "@/app/web/src/components/marketing/ProblemSection";
import HowItWorksSection from "@/app/web/src/components/marketing/HowItWorksSection";
import WhatYouGetSection from "@/app/web/src/components/marketing/WhatYouGetSection";
import SampleWorkSection from "@/app/web/src/components/marketing/SampleWorkSection";
import ComparisonSection from "@/app/web/src/components/marketing/ComparisonSection";
import PricingTeaser from "@/app/web/src/components/marketing/PricingTeaser";
import FounderNote from "@/app/web/src/components/marketing/FounderNote";
import AuditBand from "@/app/web/src/components/marketing/AuditBand";
import FaqSection, { faqJsonLd } from "@/app/web/src/components/marketing/FaqSection";
import FinalCtaSection from "@/app/web/src/components/marketing/FinalCtaSection";

/**
 * Public marketing homepage — research, strategy and creatives for D2C brands (self-serve).
 * All sections render on the server so crawlers get real copy.
 * Honesty rules: no client claims, results, logos or not-yet-live features.
 */
const Home: React.FC = () => {
  return (
    <MarketingLayout>
      <PageSeo
        title={DEFAULT_TITLE}
        description={DEFAULT_DESCRIPTION}
        path="/"
        includeSiteGraph
        jsonLd={[
          {
            "@type": "WebPage",
            "@id": `${SITE_ORIGIN}/#webpage`,
            url: absoluteUrl("/"),
            name: DEFAULT_TITLE,
            description: DEFAULT_DESCRIPTION,
            isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
            about: { "@id": `${SITE_ORIGIN}/#organization` },
            inLanguage: "en",
          },
          faqJsonLd,
        ]}
      />
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <WhatYouGetSection />
      <SampleWorkSection />
      <ComparisonSection />
      <PricingTeaser />
      <FounderNote />
      <AuditBand />
      <FaqSection />
      <FinalCtaSection />
      <noscript>
        <p style={{ padding: "1rem", textAlign: "center" }}>
          {SITE_NAME} takes D2C brands from market research to ready-to-post creatives, on a monthly
          plan. Request one free ad at {SITE_ORIGIN}/free-ad.
        </p>
      </noscript>
    </MarketingLayout>
  );
};

export default Home;
