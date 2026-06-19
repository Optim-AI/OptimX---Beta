// pages/index.tsx
import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import { HeaderSkeleton, HeroSkeleton } from "@/app/web/src/components/landing-skeletons";

/**
 * Dynamically import client-only components so Next.js DOES NOT try to run their
 * hooks during server prerender. This avoids the "reading 'useRef' of null" error.
 */

const Header = dynamic(() => import("../app/web/src/components/Header"), { ssr: false, loading: HeaderSkeleton });
const ParallaxBackground = dynamic(() => import("../app/web/src/components/ParallaxBackground"), { ssr: false });
const Hero = dynamic(() => import("../app/web/src/components/Hero"), { ssr: false, loading: HeroSkeleton });
const ComparisonSection = dynamic(() => import("../app/web/src/components/ComparisonSection"), { ssr: false });
const BuiltFor = dynamic(() => import("../app/web/src/components/BuiltFor"), { ssr: false });
const ContactForPricing = dynamic(() => import("../app/web/src/components/ContactForPricing"), { ssr: false });
const HowCreditsWork = dynamic(() => import("../app/web/src/components/HowCreditsWork"), { ssr: false });
const FAQ = dynamic(() => import("../app/web/src/components/FAQ"), { ssr: false });
const FinalCTA = dynamic(() => import("../app/web/src/components/FinalCTA"), { ssr: false });
const Footer = dynamic(() => import("../app/web/src/components/Footer"), { ssr: false });

const Home: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && !hash.includes('access_token') && !hash.includes('type=')) {
      return;
    }
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          try {
            const profileRes = await authFetch('/api/profile/get');
            const profileData = await profileRes.json();
            const p = profileData.success ? profileData.data : null;
            if (p && (p.business_name || p.businessName)) {
              router.replace("/content-studio");
            } else {
              router.replace("/welcome");
            }
          } catch {
            router.replace("/content-studio");
          }
        }
      } catch {
        // not signed in — landing page is already visible
      }
    })();
  }, [router.isReady]);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#121212' }}>
      <ParallaxBackground />
      <Header />
      <main className="relative z-10">
        <Hero />
        {/* <ComparisonSection /> */}
        <HowCreditsWork />
        <BuiltFor />
        <ContactForPricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
};

export default Home;