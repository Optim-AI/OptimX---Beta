'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Home,
  PlusCircle,
  Cpu,
  BarChart3,
  BookOpen,
  UploadCloud,
  Link2,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Folder,
  MessageSquare,
  FileText,
  Trash2,
  X,
} from 'lucide-react';
import colors from '../../../../lib/colors';

type NavItem = {
  href: string;
  label: string;
  // relaxed to `any` so lucide-react's `size` / other icon props are allowed
  Icon: React.ComponentType<any>;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: Home },
  { href: '/creative-studio', label: 'Creative Studio', Icon: PlusCircle },
  // { href: '/insights', label: 'AI Insights', Icon: Cpu },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 }, 
  { href: '/library', label: 'Campaign Library', Icon: Folder },
  { href: '/image-library', label: 'Image Library', Icon: UploadCloud },
  { href: '/integrations', label: 'Integrations', Icon: Link2 },
  { href: '/notifications', label: 'Notifications', Icon: Bell },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

type ChatItem = {
  id: string;
  title: string;
  timestamp: string;
};

type SidebarProps = {
  logoUrl?: string | null;
  onLogoClick?: () => void;
  showChatHistory?: boolean;
  chatHistory?: ChatItem[];
  activeChatId?: string | null;
  onNewChat?: () => void;
  onChatSelect?: (chatId: string) => void;
  onChatDelete?: (chatId: string) => void;
  onBrandGuideline?: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({ 
  logoUrl, 
  onLogoClick, 
  showChatHistory = false,
  chatHistory = [],
  activeChatId,
  onNewChat,
  onChatSelect,
  onChatDelete,
  onBrandGuideline,
}) => {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // Blue-themed fallbacks (use tokens from your colors object if present)
  const sidebarBg =
    (colors as any).sidebarBackgroundBlue ?? (colors as any).sidebarBackground ?? '#0b1f3b';
  const sidebarFg =
    (colors as any).sidebarForegroundLight ?? (colors as any).sidebarForeground ?? '#e6f3ff';
  const sidebarPrimary = (colors as any).sidebarPrimaryBlue ?? (colors as any).sidebarPrimary ?? '#60a5fa';
  const sidebarAccent = (colors as any).sidebarAccentBlue ?? (colors as any).sidebarAccent ?? 'rgba(96,165,250,0.08)';
  const sidebarAccentFg = (colors as any).sidebarAccentForeground ?? '#dbeafe';
  const deepShadow = (colors as any).shadowDeep ?? (colors as any).shadowMedium ?? '0 12px 40px rgba(6,18,60,0.28)';

  return (
    <aside
      className={`flex flex-col h-screen transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'}`}
      style={{
        backgroundColor: sidebarBg,
        color: sidebarFg,
        boxShadow: deepShadow,
        borderRight: 'none', // ensure no line in between
      }}
      aria-expanded={!collapsed}
    >
      {/* Header: logo on left, single OptimAI label (no duplicate) */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Logo slot (left) */}
          <button
            onClick={() => onLogoClick?.()}
            aria-label="Logo"
            className={`flex items-center justify-center rounded-md transition-all duration-200 overflow-hidden ${collapsed ? 'h-10 w-10' : 'h-12 w-12'}`}
            style={{
              background: 'transparent',
              border: `1px solid rgba(255,255,255,0.04)`,
              padding: 4,
            }}
          >
            {/* Always use the static file path for the logo */}
            <img src="/images/OptimX_Logo.svg" alt="logo" className="h-full w-full object-contain" />
          </button>

          {/* Title (single OptimAI) */}
          {!collapsed && (
            <div>
              <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                            <span style={{ color: colors.foreground }}>Optim</span>
                            <span style={{ color: colors.primary }}>X</span>
                          </span>
              <p style={{ color: sidebarFg, opacity: 0.85, fontSize: 12 }}></p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setCollapsed((s) => !s)}
          className="inline-flex items-center justify-center rounded-md p-1 transition-transform duration-200"
          style={{
            background: 'transparent',
            color: sidebarFg,
          }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation - no separators, blue hover accent */}
      <nav className="flex-1 px-2 py-3 space-y-1" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ${collapsed ? 'justify-center' : ''}`}
            style={{
              color: sidebarFg,
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = sidebarAccent;
              (e.currentTarget as HTMLElement).style.color = sidebarAccentFg;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = sidebarFg;
            }}
          >
            <item.Icon size={18} />
            <span className={`truncate text-sm ${collapsed ? 'hidden' : 'block'}`}>{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Chat History Section - Only show on Creative Studio page */}
      {showChatHistory && (
        <div className="mt-auto border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {/* New Chat & Brand Guideline Buttons */}
          <div className="px-3 py-3 space-y-2">
            <button
              onClick={() => onNewChat?.()}
              className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 font-light transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
              style={{
                backgroundColor: 'rgba(54, 145, 255, 1)',
                color: 'rgba(250, 250, 250, 1)',
                border: 'none',
                boxShadow: deepShadow,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.filter = 'brightness(0.98)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.filter = 'none';
              }}
            >
              <MessageSquare size={16} />
              <span className={`${collapsed ? 'hidden' : 'inline-block'}`}>New chat</span>
            </button>

            <button
              onClick={() => onBrandGuideline?.()}
              className={`flex items-center gap-3 w-full rounded-lg px-3 py-2 transition-colors duration-150 ${collapsed ? 'justify-center' : ''}`}
              style={{
                backgroundColor: 'rgba(235, 243, 255, 1)',
                color: 'rgba(54, 145, 255, 1)',
                border: `1px solid rgba(255, 255, 255, 0.1)`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = sidebarAccent;
                (e.currentTarget as HTMLElement).style.color = sidebarAccentFg;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(235, 243, 255, 1)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(54, 145, 255, 1)';
              }}
            >
              <FileText size={16} style={{ color: 'rgba(54, 145, 255, 1)' }} />
              <span className={`${collapsed ? 'hidden' : 'inline-block'}`} style={{ color: 'rgba(54, 145, 255, 1)', fontWeight: '300' }}>Brand guideline</span>
            </button>
          </div>

          {/* Chat History List */}
          {!collapsed && (
            <div className="px-3 pb-3">
              <div className="text-xs font-medium mb-2" style={{ color: sidebarFg, opacity: 0.7 }}>
                Your chats
              </div>
              <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {chatHistory.length === 0 ? (
                  <div className="text-xs opacity-50 px-3 py-2">No chats yet</div>
                ) : (
                  chatHistory.map((chat) => {
                  const isActive = activeChatId === chat.id;
                  return (
                    <div key={chat.id} className="flex items-center gap-2 group w-full">
                      <button
                        className="flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 min-w-0"
                        style={{
                          color: isActive ? sidebarAccentFg : sidebarFg,
                          backgroundColor: isActive ? sidebarAccent : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = sidebarAccent;
                            (e.currentTarget as HTMLElement).style.color = sidebarAccentFg;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = sidebarFg;
                          }
                        }}
                        onClick={() => onChatSelect?.(chat.id)}
                      >
                        <div className="truncate font-medium">{chat.title}</div>
                        <div className="text-xs opacity-60">{chat.timestamp}</div>
                      </button>
                      {onChatDelete ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this chat?')) {
                              onChatDelete(chat.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-2 rounded-md transition-all duration-200 hover:bg-red-500/30 active:bg-red-500/50 flex-shrink-0 flex items-center justify-center z-10"
                          style={{ 
                            color: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            minWidth: '32px',
                            minHeight: '32px',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#ffffff';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.4)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                          }}
                          aria-label="Delete chat"
                          title="Delete chat"
                        >
                          <Trash2 size={16} strokeWidth={2.5} />
                        </button>
                      ) : null}
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
