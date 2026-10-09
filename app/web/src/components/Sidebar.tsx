'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Home,
  PlusCircle,
  BarChart3,
  UploadCloud,
  Link2,
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
  Brain,
  LayoutGrid,
  Menu,
  X,
} from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { useSubscription } from '@/app/web/src/hooks/use-subscription';
import { SkeletonNavItem } from './ui/skeletons';

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  featureKey?: string;
  betaBadge?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', Icon: Home, featureKey: 'dashboard' }],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [{ href: '/creative-intelligence', label: 'Creative Intelligence', Icon: Brain, betaBadge: true }],
  },
  {
    id: 'creation',
    label: 'Creation',
    items: [
      { href: '/brand-studio', label: 'Brand Studio', Icon: Palette },
      { href: '/content-studio', label: 'Ad Studio', Icon: LayoutGrid, betaBadge: true },
    ],
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    items: [
      { href: '/create-campaign', label: 'Create Campaign', Icon: PlusCircle, featureKey: 'create_campaigns' },
      { href: '/library', label: 'Campaign Library', Icon: Folder, featureKey: 'campaign_library' },
      { href: '/generated-contents', label: 'Generated Contents', Icon: UploadCloud },
    ],
  },
  {
    id: 'measurement',
    label: 'Measurement',
    items: [{ href: '/analytics', label: 'Analytics', Icon: BarChart3, featureKey: 'basic_analytics' }],
  },
  {
    id: 'connections',
    label: 'Connections',
    items: [{ href: '/integrations', label: 'Integrations', Icon: Link2, featureKey: 'integrations' }],
  },
];

const WORKSPACE_ITEMS: NavItem[] = [
  { href: '/settings', label: 'Settings', Icon: Settings },
  { href: '/buy-credits', label: 'Buy Credits', Icon: Coins },
  { href: '/report', label: 'Report', Icon: Flag },
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

const PLAN_STYLES: Record<string, { color: string; bgColor: string; icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }> }> = {
  'Free Trial': { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', icon: Sparkles },
  'Basic': { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', icon: Zap },
  'Starter': { color: colors.primary, bgColor: colors.accent, icon: Zap },
  'Lite Growth': { color: 'hsl(262 80% 70%)', bgColor: 'hsl(262 80% 70% / 0.15)', icon: Crown },
  'Growth Pro': { color: 'hsl(330 80% 70%)', bgColor: 'hsl(330 80% 70% / 0.15)', icon: Crown },
};

const Sidebar: React.FC<SidebarProps> = ({
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
  const pathname = router.pathname;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [featureAccess, setFeatureAccess] = useState<Record<string, { enabled?: boolean; comingSoon?: boolean }>>({});
  const [featuresLoading, setFeaturesLoading] = useState(true);

  const { subscription, fetchSubscription } = useSubscription();
  const currentPlan = subscription?.plan
    ? { name: subscription.plan.name, status: subscription.status }
    : null;

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    authFetch('/api/features/access')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setFeatureAccess(data.features || {});
      })
      .catch((err) => console.error('Failed to fetch features:', err))
      .finally(() => setFeaturesLoading(false));
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const closeOverlay = () => {
      if (media.matches) setMobileOpen(false);
    };
    media.addEventListener('change', closeOverlay);
    return () => media.removeEventListener('change', closeOverlay);
  }, []);

  const showLabels = mobileOpen || !collapsed;

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === '/brand-studio' && pathname.startsWith('/brand-studio/')) return true;
    if (
      href === '/generated-contents' &&
      (pathname === '/image-library' || pathname.startsWith('/image-library/'))
    ) {
      return true;
    }
    return false;
  };

  const itemIsVisible = (item: NavItem) => {
    if (!item.featureKey) return true;
    if (featuresLoading) return true;
    const access = featureAccess[item.featureKey];
    return Boolean(access && (access.enabled || access.comingSoon));
  };

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const isReport = item.href === '/report';
    if (item.featureKey && featuresLoading) {
      return <SkeletonNavItem key={item.href} className={showLabels ? '' : 'justify-center'} />;
    }
    if (!itemIsVisible(item)) return null;

    const idleColor = isReport ? colors.destructive : colors.sidebarForeground;
    const activeColor = isReport ? colors.destructive : colors.foreground;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        aria-current={active ? 'page' : undefined}
        className={`skx-focus group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${showLabels ? '' : 'justify-center'}`}
        style={{
          color: active ? activeColor : idleColor,
          background: active ? colors.accent : 'transparent',
          fontWeight: active ? 600 : 400,
          boxShadow: active ? `inset 2px 0 0 ${isReport ? colors.destructive : colors.primary}` : 'none',
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = colors.secondary;
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
        }}
      >
        <item.Icon size={18} />
        {showLabels ? (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate">{item.label}</span>
            {item.betaBadge ? (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: colors.green100, color: colors.green600 }}
              >
                Beta
              </span>
            ) : null}
            {item.featureKey && featureAccess[item.featureKey]?.comingSoon ? (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}
              >
                Soon
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-40 flex h-12 items-center gap-3 border-b px-3 md:hidden"
        style={{ background: colors.sidebarBackground, borderColor: colors.sidebarBorder, color: colors.foreground }}
      >
        <button
          type="button"
          className="skx-focus inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ color: colors.foreground }}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <img src="/images/SkalX_Logo.png" alt="SkalX" className="h-4 w-auto object-contain" />
      </div>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`skx-motion flex w-64 shrink-0 flex-col overflow-hidden ${
          mobileOpen
            ? 'fixed inset-y-12 left-0 z-50 h-[calc(100vh-3rem)]'
            : 'fixed -left-72 top-12 z-50 h-[calc(100vh-3rem)] md:sticky md:top-0 md:left-0 md:z-auto md:h-screen md:max-h-screen'
        } ${collapsed ? 'md:w-[4.75rem]' : 'md:w-64'}`}
        style={{
          backgroundColor: colors.sidebarBackground,
          color: colors.sidebarForeground,
          borderRight: `1px solid ${colors.sidebarBorder}`,
        }}
        aria-expanded={showLabels}
        aria-label="Primary"
      >
        <div className="hidden min-w-0 items-center justify-between gap-2 px-3 py-3 md:flex">
          {onLogoClick ? (
            <button type="button" onClick={onLogoClick} className="skx-focus flex min-w-0 items-center" aria-label="SkalX home">
              <img
                src={showLabels ? '/images/SkalX_Logo.png' : '/images/SkalX_Mark.png'}
                alt=""
                className={showLabels ? 'h-5 w-auto object-contain' : 'h-6 w-6 object-contain'}
              />
            </button>
          ) : (
            <img
              src={showLabels ? '/images/SkalX_Logo.png' : '/images/SkalX_Mark.png'}
              alt="SkalX"
              className={showLabels ? 'h-5 w-auto object-contain' : 'h-6 w-6 object-contain'}
            />
          )}
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((value) => !value)}
            className="skx-focus inline-flex h-8 w-8 items-center justify-center rounded-md"
            style={{ color: colors.sidebarForeground }}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Primary">
          {NAV_GROUPS.map((group) => {
            const visible = group.items.some(itemIsVisible);
            if (!featuresLoading && !visible) return null;
            return (
              <div key={group.id} className="space-y-1">
                {showLabels ? (
                  <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.mutedForeground }}>
                    {group.label}
                  </p>
                ) : null}
                {group.items.map(renderItem)}
              </div>
            );
          })}
        </nav>

        <div className="shrink-0 space-y-1 border-t px-2 py-2" style={{ borderColor: colors.sidebarBorder }}>
          {showLabels ? (
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.mutedForeground }}>
              Workspace
            </p>
          ) : null}
          {WORKSPACE_ITEMS.map(renderItem)}
        </div>

        {currentPlan ? (
          <div className="px-2 py-2" style={{ borderTop: `1px solid ${colors.sidebarBorder}` }}>
            <Link
              href="/buy-credits"
              title={currentPlan.name}
              className={`skx-focus flex items-center gap-3 rounded-lg px-2.5 py-2 ${showLabels ? '' : 'justify-center'}`}
              style={{
                backgroundColor: PLAN_STYLES[currentPlan.name]?.bgColor || colors.secondary,
                border: `1px solid ${PLAN_STYLES[currentPlan.name]?.color || colors.border}`,
              }}
            >
              {(() => {
                const PlanIcon = PLAN_STYLES[currentPlan.name]?.icon || Zap;
                const planColor = PLAN_STYLES[currentPlan.name]?.color || colors.mutedForeground;
                return (
                  <>
                    <PlanIcon size={16} style={{ color: planColor, flexShrink: 0 }} />
                    {showLabels ? (
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold" style={{ color: planColor }}>
                          {currentPlan.name}
                        </span>
                        <span className="text-[11px]" style={{ color: colors.mutedForeground }}>
                          {currentPlan.status === 'trialing' ? 'Trial · view plans' : 'View plans'}
                        </span>
                      </span>
                    ) : null}
                  </>
                );
              })()}
            </Link>
          </div>
        ) : null}

        {(onBrandGuideline || showChatHistory) ? (
          <div style={{ borderTop: `1px solid ${colors.sidebarBorder}` }}>
            {onBrandGuideline ? (
              <div className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => onBrandGuideline()}
                  className={`skx-focus flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${showLabels ? '' : 'justify-center'}`}
                  style={{ background: colors.accent, color: colors.accentForeground }}
                >
                  <FileText size={16} />
                  {showLabels ? <span>Brand guideline</span> : null}
                </button>
              </div>
            ) : null}

            {showChatHistory ? (
              <>
                <div className="px-2 pb-2">
                  <button
                    type="button"
                    onClick={() => onNewChat?.()}
                    className={`skx-focus flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium ${showLabels ? '' : 'justify-center'}`}
                    style={{ background: colors.primary, color: colors.primaryForeground }}
                  >
                    <MessageSquare size={16} />
                    {showLabels ? <span>New session</span> : null}
                  </button>
                </div>
                {showLabels ? (
                  <div className="px-2 pb-3">
                    <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: colors.mutedForeground }}>
                      Your sessions
                    </div>
                    <div className="max-h-48 space-y-0.5 overflow-y-auto">
                      {chatHistory.length === 0 ? (
                        <div className="px-2 py-2 text-xs" style={{ color: colors.mutedForeground }}>No sessions yet</div>
                      ) : (
                        chatHistory.map((chat) => {
                          const isActiveChat = activeChatId === chat.id;
                          return (
                            <div key={chat.id} className="group flex items-center gap-1">
                              <button
                                type="button"
                                className="skx-focus min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left text-sm"
                                style={{
                                  color: isActiveChat ? colors.foreground : colors.sidebarForeground,
                                  background: isActiveChat ? colors.accent : 'transparent',
                                }}
                                onClick={() => onChatSelect?.(chat.id)}
                              >
                                <div className="truncate font-medium">{chat.title}</div>
                                <div className="text-xs" style={{ color: colors.mutedForeground }}>{chat.timestamp}</div>
                              </button>
                              {onChatDelete ? (
                                <button
                                  type="button"
                                  onClick={() => onChatDelete(chat.id)}
                                  className="skx-focus rounded-md p-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                  style={{ color: colors.destructive }}
                                  aria-label={`Delete ${chat.title}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </aside>
    </>
  );
};

export default Sidebar;
