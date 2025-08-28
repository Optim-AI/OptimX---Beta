import React from 'react';
import { Hero } from '../app/web/src/components/Hero';
import { Trusted } from '../app/web/src/components/Trusted';
import { CTA } from '../app/web/src/components/CTA';
import { Footer } from '../app/web/src/components/Footer';
import '../styles/globals.css';
const Home: React.FC = () => (
  <div>
    <Hero />
    <Trusted />
    <CTA />
    <Footer />
  </div>
);

export default Home;
