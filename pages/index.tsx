import React from 'react';
// import { Footer } from '../app/web/src/components/Footer';
import '../styles/globals.css';


import Header from "../app/web/src/components/Header";
import Hero from "../app/web/src/components/Hero";
import Problem from "../app/web/src/components/Problem";
import Features from "../app/web/src/components/Features";
import HowItWorks from "../app/web/src/components/HowItWorks";
import ContactForPricing from "../app/web/src/components/ContactForPricing";
import FAQ from "../app/web/src/components/FAQ";
import FinalCTA from "../app/web/src/components/FinalCTA";
import Footer from "../app/web/src/components/Footer";

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

export async function getServerSideProps() {
  return {
    props: {}, // This forces the page to be server-side rendered on every request
  };
}
