import React from "react";
import dynamic from "next/dynamic";
import { HeaderSkeleton } from "@/app/web/src/components/landing-skeletons";
import PageSeo from "@/components/seo/PageSeo";
import {
  AI_AD_GENERATOR_FAQS,
  AI_AD_GENERATOR_PAGE,
} from "@/lib/seo/ai-ad-generator";
import { absoluteUrl, SITE_NAME, SITE_ORIGIN } from "@/lib/seo/site";

const Header = dynamic(() => import("../app/web/src/components/Header"), {
  ssr: true,
  loading: HeaderSkeleton,
});
const ParallaxBackground = dynamic(
  () => import("../app/web/src/components/ParallaxBackground"),
  { ssr: false }
);
const AiAdGeneratorLanding = dynamic(
  () => import("../app/web/src/components/landing/AiAdGeneratorLanding"),
  { ssr: true }
);
const Footer = dynamic(() => import("../app/web/src/components/Footer"), {
  ssr: true,
});

/**
 * Public SEO + GEO landing page: AI ad generator / AI advertising generator intent.
 * CTA routes into the existing /try onboarding flow.
 */
const AiAdGeneratorPage: React.FC = () => {
  const pageUrl = absoluteUrl(AI_AD_GENERATOR_PAGE.path);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#121212" }}>
      <PageSeo
        title={AI_AD_GENERATOR_PAGE.title}
        description={AI_AD_GENERATOR_PAGE.description}
        path={AI_AD_GENERATOR_PAGE.path}
        includeSiteGraph
        jsonLd={[
          {
            "@type": "WebPage",
            "@id": `${pageUrl}#webpage`,
            url: pageUrl,
            name: `${AI_AD_GENERATOR_PAGE.title} | ${SITE_NAME}`,
            description: AI_AD_GENERATOR_PAGE.description,
            isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
            about: { "@id": `${SITE_ORIGIN}/#organization` },
            inLanguage: "en",
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: absoluteUrl("/"),
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "AI Ad Generator",
                item: pageUrl,
              },
            ],
          },
          {
            "@type": "FAQPage",
            "@id": `${pageUrl}#faq`,
            mainEntity: AI_AD_GENERATOR_FAQS.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          },
        ]}
      />
      <ParallaxBackground />
      <Header />
      <main className="relative z-10">
        <AiAdGeneratorLanding />
      </main>
      <Footer />
      <noscript>
        <div style={{ padding: "2rem", maxWidth: 720, margin: "0 auto", color: "#fff" }}>
          <h1>Create Ads for Your Brand with AI</h1>
          <p>
            SkalX AI is an AI marketing platform and AI ad generator that understands your brand
            and creates campaign-ready ad creatives, posters, and short marketing videos. Start at{" "}
            {absoluteUrl("/try")}.
          </p>
        </div>
      </noscript>
    </div>
  );
};

export default AiAdGeneratorPage;
