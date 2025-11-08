'use client';

import React from 'react';
import colors from '../../../../lib/colors';

const Trusted: React.FC = () => {
  return (
    <section
      className="py-8"
      style={{
        backgroundColor: colors.sectionBackground || colors.muted,
      }}
    >
      <div className="container mx-auto text-center">
        <h2
          className="text-2xl font-bold"
          style={{ color: colors.foreground }}
        >
          Trusted by{' '}
          <span style={{ color: colors.primary }}>1000+</span> businesses
        </h2>

        <div
          className="flex flex-wrap justify-center gap-4 mt-4"
          style={{ color: colors.mutedForeground }}
        >
          <span>Fashion Brands</span>
          <span>Restaurants</span>
          <span>Electronics</span>
          <span>Beauty</span>
          <span>Local Stores</span>
        </div>
      </div>
    </section>
  );
};

export default Trusted;
