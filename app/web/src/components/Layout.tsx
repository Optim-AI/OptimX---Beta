// components/Layout.tsx
import React from 'react';
import Sidebar from './Sidebar';
; // match your Sidebar path
// If path differs, adjust accordingly.

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafafa' }}>
      <aside style={{ width: 260, borderRight: '1px solid rgba(0,0,0,0.04)', background: '#fff' }}>
        <Sidebar />
      </aside>

      <main style={{ flex: 1, padding: 28 }}>
        {children}
      </main>
    </div>
  );
}
