// pages/index.tsx
import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';

/**
 * Dynamically import client-only components so Next.js DOES NOT try to run their
 * hooks during server prerender. This avoids the "reading 'useRef' of null" error.
 *
 * If some components are pure server components, you can keep normal imports for those.
 */

const HeaderSkeleton = () => (
  <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6" style={{ background: 'rgba(18,18,18,0.85)', backdropFilter: 'blur(12px)' }}>
    <div className="h-8 w-28 rounded bg-white/5" />
    <div className="ml-auto flex gap-4">
      {[1, 2, 3].map(i => <div key={i} className="h-4 w-16 rounded bg-white/5" />)}
    </div>
  </header>
);

const HeroSkeleton = () => (
  <section className="pt-28 pb-20 min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#121212' }}>
    <div className="text-center mb-4 mx-auto max-w-6xl">
      <div className="h-12 w-[420px] max-w-full mx-auto rounded bg-white/5 mb-4" />
      <div className="h-6 w-[520px] max-w-full mx-auto rounded bg-white/[0.03] mb-8" />
    </div>
    <div className="w-full max-w-2xl mx-auto p-8 rounded-[20px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(97,97,97,0.5)' }}>
      <div className="h-12 w-full rounded-[18px] bg-white/5 mb-5" />
      <div className="flex justify-center gap-4">
        <div className="h-12 w-40 rounded-xl bg-blue-500/20" />
        <div className="h-12 w-40 rounded-xl bg-white/5" />
      </div>
    </div>
  </section>
);

const Header = dynamic(() => import("../app/web/src/components/Header"), { ssr: false, loading: HeaderSkeleton });
const ParallaxBackground = dynamic(() => import("../app/web/src/components/ParallaxBackground"), { ssr: false });
const Hero = dynamic(() => import("../app/web/src/components/Hero"), { ssr: false, loading: HeroSkeleton });
const ComparisonSection = dynamic(() => import("../app/web/src/components/ComparisonSection"), { ssr: false });
const BuiltFor = dynamic(() => import("../app/web/src/components/BuiltFor"), { ssr: false });
const PricingPreview = dynamic(() => import("../app/web/src/components/PricingPreview"), { ssr: false });
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
              router.replace("/brand-studio");
            } else {
              router.replace("/welcome");
            }
          } catch {
            router.replace("/brand-studio");
          }
        }
      } catch {
        // not signed in — landing page is already visible
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#121212' }}>
      <ParallaxBackground />
      <Header />
      <main className="relative z-10">
        <Hero />
        {/* <ComparisonSection /> */}
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