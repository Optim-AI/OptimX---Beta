'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import colors from '../../../../lib/colors';

const Sidebar: React.FC = () => {
  const router = useRouter();

  return (
    <aside
      className="w-64 flex flex-col"
      style={{
        backgroundColor: colors.sidebarBackground,
        color: colors.sidebarForeground,
        boxShadow: colors.shadowSoft,
        borderRight: `1px solid ${colors.sidebarBorder}`,
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 border-b"
        style={{ borderColor: colors.sidebarBorder }}
      >
        <h1
          className="text-xl font-bold"
          style={{ color: colors.sidebarPrimary }}
        >
          OptimAI
        </h1>
        <p style={{ color: colors.sidebarForeground, fontSize: 12 }}>
          Campaign Manager
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {[
          { href: '/dashboard', label: '📊 Dashboard' },
          { href: '/create-campaign', label: '➕ Create Campaign' },
          { href: '/insights', label: '🤖 AI Insights' },
          { href: '/analytics', label: '📈 Analytics' },
          { href: '/library', label: '📚 Campaign Library' },
          { href: '/publish', label: '📤 Publishing' },
          { href: '/integrations', label: '🔗 Integrations' },
          { href: '/notifications', label: '🔔 Notifications' },
          { href: '/settings', label: '⚙️ Settings' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-3 py-2 rounded-lg transition-colors duration-150"
            style={{
              color: colors.sidebarForeground,
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                colors.sidebarAccent;
              (e.currentTarget as HTMLElement).style.color =
                colors.sidebarAccentForeground;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                'transparent';
              (e.currentTarget as HTMLElement).style.color =
                colors.sidebarForeground;
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer Button */}
      <div
        className="p-4 border-t"
        style={{ borderColor: colors.sidebarBorder }}
      >
        <button
          onClick={() => router.push('/create-campaign')}
          className="w-full rounded-lg px-4 py-2 font-medium transition"
          style={{
            backgroundColor: colors.sidebarPrimary,
            color: colors.sidebarPrimaryForeground,
            border: 'none',
            boxShadow: colors.shadowMedium,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.filter = 'brightness(0.98)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.filter = 'none';
          }}
        >
          Start Campaign
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
