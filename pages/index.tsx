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
const Hero = dynamic(() => import("../app/web/src/components/Hero"), { ssr: false });
const Problem = dynamic(() => import("../app/web/src/components/Problem"), { ssr: false });
const Features = dynamic(() => import("../app/web/src/components/Features"), { ssr: false });
const HowItWorks = dynamic(() => import("../app/web/src/components/HowItWorks"), { ssr: false });
const ContactForPricing = dynamic(() => import("../app/web/src/components/ContactForPricing"), { ssr: false });
const FAQ = dynamic(() => import("../app/web/src/components/FAQ"), { ssr: false });
const FinalCTA = dynamic(() => import("../app/web/src/components/FinalCTA"), { ssr: false });
const Footer = dynamic(() => import("../app/web/src/components/Footer"), { ssr: false });

const Home: React.FC = () => (
  <div className="min-h-screen">
    <Header />
    <main>
      <Hero />
      <Problem />
      <Features />
      <HowItWorks />
      <ContactForPricing />
      <FAQ />
      <FinalCTA />
    </main>
    <Footer />
  </div>
);

export default Home;
