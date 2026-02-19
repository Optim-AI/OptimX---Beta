// pages/index.tsx
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
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

const Home: React.FC = () => {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // If the URL has a hash (e.g. /#pricing), skip the redirect so the user can see the section
    if (window.location.hash) {
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          // Check if user has completed onboarding
          try {
            const profileRes = await authFetch('/api/profile/get');
            const profileData = await profileRes.json();
            const p = profileData.success ? profileData.data : null;
            if (p && (p.business_name || p.businessName)) {
              router.replace("/creative-studio");
            } else {
              router.replace("/welcome");
            }
          } catch {
            router.replace("/creative-studio");
          }
          return;
        }
      } catch {
        // not signed in, show landing page
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return <div style={{ minHeight: "100vh", backgroundColor: "#121212" }} />;
  }

  return (
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
};

export default Home;