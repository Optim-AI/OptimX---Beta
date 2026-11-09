// pages/index.tsx
import React from "react";
import PageSeo from "@/components/seo/PageSeo";
import { absoluteUrl, SITE_NAME, SITE_ORIGIN } from "@/lib/seo/site";
import { HERO } from "@/content/home";
import { PRICING_PLANS } from "@/content/pricing";
import MarketingLayout from "@/app/web/src/components/marketing/MarketingLayout";
import { faqJsonLd } from "@/app/web/src/components/marketing/kit/FAQAccordion";
import HomeHero from "@/app/web/src/components/marketing/home/HomeHero";
import ProblemBlock from "@/app/web/src/components/marketing/home/ProblemBlock";
import ThinkingStages from "@/app/web/src/components/marketing/home/ThinkingStages";
import Showcase from "@/app/web/src/components/marketing/home/Showcase";
import {
  MakesSection,
  StartFromSection,
  StatsSection,
  TestFirstSection,
  UgcSection,
} from "@/app/web/src/components/marketing/home/MidSections";
import PhotoshootSection from "@/app/web/src/components/marketing/home/PhotoshootSection";
import AdAnalyticsSection from "@/app/web/src/components/marketing/home/AdAnalyticsSection";
import {
  DoneForYouSection,
  FaqBlock,
  FinalCtaBand,
  getHomeFaqs,
  HowItWorksSteps,
  PlatformsSection,
  PricingTeaserSection,
  TestimonialsSection,
} from "@/app/web/src/components/marketing/home/EndSections";

const TITLE = "SkalX — Know what works. Then make it.";
const DESCRIPTION =
  "SkalX understands your brand, competitors and customers, builds your marketing strategy, and turns it into ready-to-use posters, videos and UGC style ads. Free brand audit, no card needed.";

/**
 * Public homepage. Section order follows the site plan (hero → proof → problem → how SkalX
 * thinks → showcase → … → final CTA). All copy lives in content/*.ts.
 * Honesty rules: no invented numbers, testimonials, logos or not-yet-live features.
 */
const Home: React.FC = () => {
  return (
    <MarketingLayout>
      <PageSeo
        title={TITLE}
        description={DESCRIPTION}
        path="/"
        includeSiteGraph
        jsonLd={[
          {
            "@type": "WebPage",
            "@id": `${SITE_ORIGIN}/#webpage`,
            url: absoluteUrl("/"),
            name: TITLE,
            description: DESCRIPTION,
            isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
            about: { "@id": `${SITE_ORIGIN}/#organization` },
            inLanguage: "en",
          },
          {
            "@type": "SoftwareApplication",
            "@id": `${SITE_ORIGIN}/#software`,
            name: "SkalX",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description: DESCRIPTION,
            url: absoluteUrl("/"),
            publisher: { "@id": `${SITE_ORIGIN}/#organization` },
            offers: PRICING_PLANS.map((p) => ({
              "@type": "Offer",
              name: p.name,
              price: String(p.priceInr),
              priceCurrency: "INR",
              description: "Monthly plan, price before 18% GST",
            })),
          },
          faqJsonLd(getHomeFaqs()),
        ]}
      />
      <HomeHero />
      <ProblemBlock />
      <ThinkingStages />
      <Showcase />
      <StatsSection />
      <UgcSection />
      <PhotoshootSection />
      <TestFirstSection />
      <AdAnalyticsSection />
      <MakesSection />
      <StartFromSection />
      <PlatformsSection />
      <HowItWorksSteps />
      <DoneForYouSection />
      <TestimonialsSection />
      <PricingTeaserSection />
      <FaqBlock />
      <FinalCtaBand />
      <noscript>
        <p style={{ padding: "1rem", textAlign: "center" }}>
          {SITE_NAME}: {HERO.title} {HERO.sub} Get a free brand audit at {SITE_ORIGIN}.
        </p>
      </noscript>
    </MarketingLayout>
  );
};

export default Home;
