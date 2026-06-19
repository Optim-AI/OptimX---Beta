import React from 'react';

export function HeaderSkeleton() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-6" style={{ background: 'rgba(18,18,18,0.85)', backdropFilter: 'blur(12px)' }}>
      <div className="h-8 w-28 rounded bg-white/5" />
      <div className="ml-auto flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 w-16 rounded bg-white/5" />
        ))}
      </div>
    </header>
  );
}

export function HeroSkeleton() {
  return (
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
}
