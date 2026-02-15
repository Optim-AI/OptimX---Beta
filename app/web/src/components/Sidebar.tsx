'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
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
  Palette,
  Folder,
  MessageSquare,
  FileText,
  Trash2,
  Crown,
  Sparkles,
  Zap,
  Coins,
  Flag,
} from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<any>;
  featureKey?: string; // Optional feature key for gating
};

// Map routes to feature keys for gating
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', Icon: Home, featureKey: 'dashboard' },
  { href: '/creative-studio', label: 'Creative Studio', Icon: Palette }, // Always visible
  { href: '/buy-credits', label: 'Buy Credits', Icon: Coins }, // Always visible (pay-as-you-go)
  { href: '/create-campaign', label: 'Create Campaign', Icon: PlusCircle, featureKey: 'create_campaigns' },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3, featureKey: 'basic_analytics' },
  { href: '/library', label: 'Campaign Library', Icon: Folder, featureKey: 'campaign_library' },
  { href: '/image-library', label: 'Image Library', Icon: UploadCloud }, // Always visible
  { href: '/integrations', label: 'Integrations', Icon: Link2, featureKey: 'integrations' },
  { href: '/notifications', label: 'Notifications', Icon: Bell }, // Always visible
  { href: '/settings', label: 'Settings', Icon: Settings }, // Always visible
  { href: '/report', label: 'Report', Icon: Flag }, // Report errors or feedback
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

// Plan styling configuration
const PLAN_STYLES: Record<string, { color: string; bgColor: string; icon: React.ComponentType<any> }> = {
  'Free Trial': { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: Sparkles },
  'Basic': { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', icon: Zap },
  'Starter': { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: Zap },
  'Lite Growth': { color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', icon: Crown },
  'Growth Pro': { color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.15)', icon: Crown },
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
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<{ name: string; status: string } | null>(null);
  const [featureAccess, setFeatureAccess] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Fetch current subscription and feature access on mount
  useEffect(() => {
    async function fetchSubscriptionAndFeatures() {
      try {
        const response = await authFetch('/api/billing/subscriptions/current');
        const data = await response.json();
        if (data.success && data.hasSubscription && data.subscription?.plan) {
          setCurrentPlan({
            name: data.subscription.plan.name,
            status: data.subscription.status,
          });
        }

        // Fetch feature access
        const featuresResponse = await authFetch('/api/features/access');
        const featuresData = await featuresResponse.json();
        if (featuresData.success) {
          setFeatureAccess(featuresData.features || {});
        }
      } catch (err) {
        console.error('Failed to fetch subscription/features:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubscriptionAndFeatures();
  }, []);

  // Blue-themed fallbacks (use tokens from your colors object if present)
  const sidebarBg =
    (colors as any).sidebarBackgroundBlue ?? (colors as any).sidebarBackground ?? '#0b1f3b';
  const sidebarFg =
    (colors as any).sidebarForegroundLight ?? (colors as any).sidebarForeground ?? '#e6f3ff';
  const sidebarPrimary = (colors as any).sidebarPrimaryBlue ?? (colors as any).sidebarPrimary ?? '#60a5fa';
  const sidebarAccent = (colors as any).sidebarAccentBlue ?? (colors as any).sidebarAccent ?? 'rgba(96,165,250,0.08)';
  const sidebarAccentFg = (colors as any).sidebarAccentForeground ?? '#dbeafe';
  const deepShadow = (colors as any).shadowDeep ?? (colors as any).shadowMedium ?? '0 12px 40px rgba(6,18,60,0.28)';
  // Report item: red CTA styling
  const reportRed = (colors as any).destructive ?? '#ef4444';
  const reportAccent = 'rgba(239, 68, 68, 0.12)';
  const reportAccentFg = '#fecaca';

  // Helper function to check if a route is active
  const isActive = (href: string) => pathname === href;

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
      {/* Header: logo on left, single SkalX AI label (no duplicate) */}
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
            <img src="/images/Oli_AI_Logo.svg" alt="logo" className="h-full w-full object-contain" />
          </button>

          {/* Title (single SkalX AI) */}
          {!collapsed && (
            <div>
              <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                            <span style={{ color: colors.foreground }}>SkalX AI</span>
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
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const isReport = item.href === '/report';
          const itemPrimary = isReport ? reportRed : sidebarPrimary;
          const itemAccent = isReport ? reportAccent : sidebarAccent;
          const itemAccentFg = isReport ? reportAccentFg : sidebarAccentFg;
          
          // Check feature access for gated items
          if (item.featureKey) {
            const access = featureAccess[item.featureKey];
            // Hide if feature is not enabled and not coming soon
            if (!access || (!access.enabled && !access.comingSoon)) {
              return null;
            }
          }
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors duration-150 ${collapsed ? 'justify-center' : ''}`}
              style={{
                color: active ? itemPrimary : (isReport ? reportRed : sidebarFg),
                background: active ? itemAccent : 'transparent',
                fontWeight: active ? 600 : 400,
                borderLeft: active ? `3px solid ${itemPrimary}` : '3px solid transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = itemAccent;
                  (e.currentTarget as HTMLElement).style.color = itemAccentFg;
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = isReport ? reportRed : sidebarFg;
                }
              }}
            >
              <item.Icon size={18} />
              <span className={`truncate text-sm ${collapsed ? 'hidden' : 'block'}`}>
                {item.label}
                {/* Show "Coming Soon" badge if applicable */}
                {item.featureKey && featureAccess[item.featureKey]?.comingSoon && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'rgba(245, 158, 11, 0.2)',
                    color: '#f59e0b',
                    fontWeight: 600,
                  }}>
                    Soon
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Current Plan Badge */}
      {currentPlan && (
        <div className={`px-3 py-3 border-t ${!(onBrandGuideline || showChatHistory) ? 'mt-auto' : ''}`} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Link
            href="/#pricing"
            className={`flex items-center gap-3 w-full rounded-lg px-3 py-2.5 transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
            style={{
              backgroundColor: PLAN_STYLES[currentPlan.name]?.bgColor || 'rgba(100, 116, 139, 0.15)',
              border: `1px solid ${PLAN_STYLES[currentPlan.name]?.color || '#64748b'}40`,
            }}
          >
            {(() => {
              const PlanIcon = PLAN_STYLES[currentPlan.name]?.icon || Zap;
              const planColor = PLAN_STYLES[currentPlan.name]?.color || '#64748b';
              return (
                <>
                  <PlanIcon size={18} style={{ color: planColor, flexShrink: 0 }} />
                  {!collapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate" style={{ color: planColor }}>
                          {currentPlan.name}
                        </span>
                        {currentPlan.status === 'trialing' && (
                          <span 
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ 
                              backgroundColor: `${planColor}30`,
                              color: planColor,
                            }}
                          >
                            Trial
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] opacity-70" style={{ color: sidebarFg }}>
                        View plans
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </Link>
        </div>
      )}

      {/* Bottom Section - Brand Guideline (always shown when onBrandGuideline is provided) and Session History */}
      {(onBrandGuideline || showChatHistory) && (
        <div className={`border-t ${!currentPlan ? 'mt-auto' : ''}`} style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          {/* Brand Guideline Button - Always shown when callback provided */}
          {onBrandGuideline && (
            <div className="px-3 py-3">
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
          )}

          {/* Session History Section - Only show on session pages */}
          {showChatHistory && (
            <>
              {/* New Session Button */}
              <div className="px-3 pb-2">
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
                  <span className={`${collapsed ? 'hidden' : 'inline-block'}`}>New session</span>
                </button>
              </div>

              {/* Session History List */}
              {!collapsed && (
                <div className="px-3 pb-3">
                  <div className="text-xs font-medium mb-2" style={{ color: sidebarFg, opacity: 0.7 }}>
                    Your sessions
                  </div>
                  <div className="space-y-1 max-h-[calc(100vh-380px)] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {chatHistory.length === 0 ? (
                      <div className="text-xs opacity-50 px-3 py-2">No sessions yet</div>
                    ) : (
                      chatHistory.map((chat) => {
                        const isActiveChat = activeChatId === chat.id;
                        return (
                          <div key={chat.id} className="flex items-center gap-2 group w-full">
                            <button
                              className="flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 min-w-0"
                              style={{
                                color: isActiveChat ? sidebarAccentFg : sidebarFg,
                                backgroundColor: isActiveChat ? sidebarAccent : 'transparent',
                              }}
                              onMouseEnter={(e) => {
                                if (!isActiveChat) {
                                  (e.currentTarget as HTMLElement).style.backgroundColor = sidebarAccent;
                                  (e.currentTarget as HTMLElement).style.color = sidebarAccentFg;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isActiveChat) {
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
                                  onChatDelete(chat.id);
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
                                aria-label="Delete session"
                                title="Delete session"
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
            </>
          )}
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
