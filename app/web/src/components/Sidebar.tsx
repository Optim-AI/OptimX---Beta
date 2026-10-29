'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  LayoutGrid,
  Orbit,
  Image as ImageIcon,
  ChartColumn,
  Folder,
  Library,
  FileText,
  Link2,
  SlidersHorizontal,
  Flag,
  PanelLeft,
  Plus,
  PlusCircle,
  MessageSquare,
  Trash2,
  ChevronsUpDown,
  Palette,
  ScanSearch,
  Camera,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import { SkeletonNavItem } from './ui/skeletons';

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  featureKey?: string;
  betaBadge?: boolean;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', Icon: LayoutGrid, featureKey: 'dashboard' },
    ],
  },
  {
    id: 'create',
    label: 'Create',
    items: [
      { href: '/brand-kit', label: 'Brand Kit', Icon: Palette },
      { href: '/photo-studio', label: 'Photo Studio', Icon: Camera, betaBadge: true },
      { href: '/brand-studio', label: 'Brand Studio', Icon: Orbit },
      { href: '/content-studio', label: 'Ad Studio', Icon: ImageIcon, betaBadge: true },
      { href: '/create-campaign', label: 'Create Campaign', Icon: PlusCircle, featureKey: 'create_campaigns' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      { href: '/brand-research', label: 'Brand Research', Icon: ScanSearch },
      { href: '/analytics', label: 'Analytics', Icon: ChartColumn, featureKey: 'basic_analytics' },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    items: [
      { href: '/image-library', label: 'Generated Contents', Icon: Folder },
      { href: '/library', label: 'Campaign Library', Icon: Library, featureKey: 'campaign_library' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { href: '/buy-credits', label: 'Plans & Purchases', Icon: FileText },
      { href: '/integrations', label: 'Integrations', Icon: Link2, featureKey: 'integrations' },
      { href: '/settings', label: 'Settings', Icon: SlidersHorizontal },
    ],
  },
];

const REPORT_ITEM: NavItem = {
  href: '/report',
  label: 'Report an issue',
  Icon: Flag,
};

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

type FeatureAccess = {
  enabled?: boolean;
  comingSoon?: boolean;
};

const SURFACE = '#141416';
const LINE = 'rgba(255,255,255,0.08)';
const LABEL = '#6e6e76';
const ITEM = '#a3a3ab';
const ACTIVE_BG = '#2a2a31';
const HOVER_BG = 'rgba(255,255,255,0.045)';

function isRouteActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
  const [featureAccess, setFeatureAccess] = useState<Record<string, FeatureAccess>>({});
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountInitial, setAccountInitial] = useState('');
  const accountRef = useRef<HTMLDivElement>(null);
  const signingOut = useRef(false);

  // Every app page has the sidebar, so it guards the session: signed out or expired →
  // sign in, then come back to this page (instead of half-loaded pages and stuck loaders).
  const toSignIn = React.useCallback(() => {
    const next = signingOut.current ? '' : `?next=${encodeURIComponent(router.asPath)}`;
    void router.replace(`/auth/signin${next}`);
  }, [router]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') toSignIn();
    });
    return () => data.subscription.unsubscribe();
  }, [toSignIn]);

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
    let cancelled = false;
    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (cancelled) return;
        const user = data.user;
        // No user and not just offline → the session is gone.
        if (!user && error?.name !== 'AuthRetryableFetchError') {
          toSignIn();
          return;
        }
        const meta = (user?.user_metadata ?? {}) as { full_name?: string; fullName?: string };
        const source = meta.full_name || meta.fullName || user?.email || 'A';
        const letter = source.trim().charAt(0).toUpperCase();
        if (letter) setAccountInitial(letter);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [toSignIn]);

  useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  const itemState = (item: NavItem): 'hidden' | 'loading' | 'visible' => {
    if (!item.featureKey) return 'visible';
    if (featuresLoading) return 'loading';
    const access = featureAccess[item.featureKey];
    if (!access || (!access.enabled && !access.comingSoon)) return 'hidden';
    return 'visible';
  };

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    entries: section.items
      .map((item) => ({ item, state: itemState(item) }))
      .filter(
        (entry): entry is { item: NavItem; state: 'loading' | 'visible' } =>
          entry.state !== 'hidden'
      ),
  })).filter((section) => section.entries.length > 0);

  async function handleSignOut() {
    setAccountOpen(false);
    signingOut.current = true;
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('signOut error', error);
    }
    router.push('/auth/signin');
  }

  const renderItem = (item: NavItem, state: 'loading' | 'visible') => {
    if (state === 'loading') {
      return <SkeletonNavItem key={item.href} className={collapsed ? 'justify-center px-0' : ''} />;
    }

    const active = isRouteActive(pathname, item.href);
    const comingSoon = Boolean(item.featureKey && featureAccess[item.featureKey]?.comingSoon);
    const isReport = item.href === REPORT_ITEM.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-2.5 rounded-lg transition-colors duration-150 ${
          collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2'
        }`}
        style={{
          color: isReport ? '#f05252' : active ? '#ffffff' : ITEM,
          background: active ? ACTIVE_BG : 'transparent',
          fontWeight: active ? 500 : 400,
        }}
        onMouseEnter={(event) => {
          if (active) return;
          event.currentTarget.style.background = isReport ? 'rgba(240,82,82,0.08)' : HOVER_BG;
          if (!isReport) event.currentTarget.style.color = '#f4f4f5';
        }}
        onMouseLeave={(event) => {
          if (active) return;
          event.currentTarget.style.background = 'transparent';
          event.currentTarget.style.color = isReport ? '#f05252' : ITEM;
        }}
      >
        <item.Icon size={16} strokeWidth={1.75} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="min-w-0 truncate text-[13px] leading-5">{item.label}</span>
            {(item.betaBadge || comingSoon) && (
              <span className="ml-auto flex shrink-0 items-center gap-1">
                {item.betaBadge && (
                  <span
                    className="rounded-full px-1.5 py-[3px] text-[10px] font-semibold leading-none"
                    style={{ color: '#3ecf8e', background: 'rgba(62, 207, 142, 0.14)' }}
                  >
                    Beta
                  </span>
                )}
                {comingSoon && (
                  <span
                    className="rounded-full px-1.5 py-[3px] text-[10px] font-semibold leading-none"
                    style={{ color: '#f5b942', background: 'rgba(245, 185, 66, 0.14)' }}
                  >
                    Soon
                  </span>
                )}
              </span>
            )}
          </>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`flex h-screen shrink-0 flex-col transition-[width] duration-200 ease-out ${
        collapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
      style={{
        backgroundColor: SURFACE,
        color: ITEM,
        borderRight: `1px solid ${LINE}`,
      }}
      aria-expanded={!collapsed}
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className={`flex items-center ${collapsed ? 'justify-center px-2' : 'justify-between px-4'} py-4`}>
        {!collapsed &&
          (onLogoClick ? (
            <button type="button" onClick={onLogoClick} className="rounded-md" aria-label="SkalX">
              <img src="/images/SkalX_Logo.png" alt="SkalX" className="h-5 w-auto object-contain" />
            </button>
          ) : (
            <Link href="/dashboard" className="rounded-md" aria-label="SkalX">
              <img src="/images/SkalX_Logo.png" alt="SkalX" className="h-5 w-auto object-contain" />
            </Link>
          ))}
        <button
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => {
            setAccountOpen(false);
            setCollapsed((open) => !open);
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          style={{ color: '#8d8d95' }}
          onMouseEnter={(event) => {
            event.currentTarget.style.background = HOVER_BG;
            event.currentTarget.style.color = '#f4f4f5';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.background = 'transparent';
            event.currentTarget.style.color = '#8d8d95';
          }}
        >
          <PanelLeft size={16} strokeWidth={1.75} />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3" aria-label="Primary" style={{ scrollbarWidth: 'thin' }}>
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={index === 0 ? '' : 'mt-2 border-t pt-2'}
            style={index === 0 ? undefined : { borderColor: LINE }}
          >
            {!collapsed && (
              <div
                className="px-2.5 pb-1.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: LABEL }}
              >
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.entries.map(({ item, state }) => renderItem(item, state))}
            </div>
          </div>
        ))}

        <div className="mt-2 border-t pt-2" style={{ borderColor: LINE }}>
          {renderItem(REPORT_ITEM, 'visible')}
        </div>
      </nav>

      {(onBrandGuideline || showChatHistory) && (
        <div className="border-t px-2.5 py-2.5" style={{ borderColor: LINE }}>
          {onBrandGuideline && (
            <button
              type="button"
              onClick={() => onBrandGuideline()}
              title={collapsed ? 'Brand kit' : undefined}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg py-2 text-[13px] transition-colors ${
                collapsed ? 'justify-center px-2' : 'px-2.5'
              }`}
              style={{ color: ITEM }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = HOVER_BG;
                event.currentTarget.style.color = '#f4f4f5';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
                event.currentTarget.style.color = ITEM;
              }}
            >
              <FileText size={16} strokeWidth={1.75} />
              {!collapsed && <span>Brand kit</span>}
            </button>
          )}

          {showChatHistory && (
            <>
              <button
                type="button"
                onClick={() => onNewChat?.()}
                title={collapsed ? 'New session' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-colors ${
                  collapsed ? 'justify-center px-2' : 'px-2.5'
                }`}
                style={{ color: '#f4f4f5', background: 'rgba(255,255,255,0.04)' }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
              >
                {collapsed ? <Plus size={16} strokeWidth={1.75} /> : <MessageSquare size={16} strokeWidth={1.75} />}
                {!collapsed && <span>New session</span>}
              </button>

              {!collapsed && (
                <div className="mt-2">
                  <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: LABEL }}>
                    Your sessions
                  </div>
                  <div className="max-h-52 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {chatHistory.length === 0 ? (
                      <div className="px-2.5 py-2 text-xs" style={{ color: LABEL }}>
                        No sessions yet
                      </div>
                    ) : (
                      chatHistory.map((chat) => {
                        const isActiveChat = activeChatId === chat.id;
                        return (
                          <div key={chat.id} className="group flex items-center gap-1">
                            <button
                              type="button"
                              className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left"
                              style={{
                                color: isActiveChat ? '#ffffff' : ITEM,
                                background: isActiveChat ? ACTIVE_BG : 'transparent',
                              }}
                              onMouseEnter={(event) => {
                                if (!isActiveChat) event.currentTarget.style.background = HOVER_BG;
                              }}
                              onMouseLeave={(event) => {
                                if (!isActiveChat) event.currentTarget.style.background = 'transparent';
                              }}
                              onClick={() => onChatSelect?.(chat.id)}
                            >
                              <div className="truncate text-[13px]">{chat.title}</div>
                              <div className="truncate text-[11px]" style={{ color: LABEL }}>
                                {chat.timestamp}
                              </div>
                            </button>
                            {onChatDelete ? (
                              <button
                                type="button"
                                onClick={() => onChatDelete(chat.id)}
                                className="rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100"
                                style={{ color: '#f05252' }}
                                aria-label="Delete session"
                                title="Delete session"
                              >
                                <Trash2 size={14} strokeWidth={1.75} />
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

      <div ref={accountRef} className="relative border-t px-2.5 py-2.5" style={{ borderColor: LINE }}>
        {accountOpen && !collapsed && (
          <div
            role="menu"
            className="absolute bottom-full left-2.5 right-2.5 z-30 mb-2 overflow-hidden rounded-xl border py-1 shadow-xl"
            style={{ background: '#1c1c21', borderColor: LINE }}
          >
            <Link
              href="/settings"
              role="menuitem"
              className="block px-3 py-2 text-[13px] transition-colors"
              style={{ color: '#f4f4f5' }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = HOVER_BG;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              Settings
            </Link>
            <Link
              href="/buy-credits"
              role="menuitem"
              className="block px-3 py-2 text-[13px] transition-colors"
              style={{ color: '#f4f4f5' }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = HOVER_BG;
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              Plans & Purchases
            </Link>
            <div className="my-1 border-t" style={{ borderColor: LINE }} />
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-[13px] transition-colors"
              style={{ color: '#f05252' }}
              onClick={handleSignOut}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = 'rgba(240,82,82,0.08)';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = 'transparent';
              }}
            >
              Sign out
            </button>
          </div>
        )}

        {collapsed ? (
          <Link
            href="/settings"
            title="Account"
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ background: '#2a2a31', color: '#ffffff' }}
          >
            {accountInitial}
          </Link>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors"
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((open) => !open)}
            onMouseEnter={(event) => {
              event.currentTarget.style.background = HOVER_BG;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
              style={{ background: '#2a2a31', color: '#ffffff' }}
            >
              {accountInitial}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium leading-4" style={{ color: '#ffffff' }}>
                Account
              </span>
              <span className="block truncate text-[11px] leading-4" style={{ color: LABEL }}>
                Manage your workspace
              </span>
            </span>
            <ChevronsUpDown size={14} strokeWidth={1.75} style={{ color: '#8d8d95' }} />
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
