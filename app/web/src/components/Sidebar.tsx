'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AD_PERFORMANCE_LIVE, TRENDS_LIVE } from '@/lib/launch-flags';
import {
  Orbit,
  Image as ImageIcon,
  Folder,
  Library,
  FileText,
  Flag,
  PanelLeft,
  Plus,
  PlusCircle,
  MessageSquare,
  Trash2,
  ChevronsUpDown,
  ChevronDown,
  Palette,
  ScanSearch,
  TrendingUp,
  Flame,
  Camera,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import { SkeletonNavItem } from './ui/skeletons';
import AgentOrb from './agent/AgentOrb';

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  featureKey?: string;
  betaBadge?: boolean;
  /** Shows a "Soon" badge; the page itself explains it is coming. */
  comingSoon?: boolean;
  /** Soft colour for the icon tile (hex) */
  tint?: string;
};

type NavSection = {
  id: string;
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  // Dashboard is hidden until the overview screen is ready to ship.
  // The Marketing Agent has its own highlighted row above these sections (AGENT_HREF).
  {
    id: 'create',
    label: 'Create',
    items: [
      { href: '/brand-kit', label: 'Brand Kit', Icon: Palette, tint: '#a78bfa' },
      { href: '/photo-studio', label: 'Photoshoot Studio', Icon: Camera, tint: '#f5b942' },
      { href: '/brand-studio', label: 'Brand Studio', Icon: Orbit, tint: '#f472b6' },
      { href: '/content-studio', label: 'Ad Studio', Icon: ImageIcon, tint: '#60a5fa' },
      { href: '/ugc-studio', label: 'UGC Studio', Icon: Smartphone, comingSoon: true, tint: '#2dd4bf' },
      { href: '/create-campaign', label: 'Create Campaign', Icon: PlusCircle, featureKey: 'create_campaigns', tint: '#38bdf8' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { href: '/brand-research', label: 'Brand Research', Icon: ScanSearch, tint: '#34d399' },
      { href: '/meta-intelligence', label: 'Ad Performance', Icon: TrendingUp, comingSoon: !AD_PERFORMANCE_LIVE, tint: '#22d3ee' },
      { href: '/trends', label: 'Trends', Icon: Flame, comingSoon: !TRENDS_LIVE, tint: '#f87171' },
    ],
  },
  {
    id: 'library',
    label: 'Library',
    items: [
      { href: '/image-library', label: 'Generated Contents', Icon: Folder, tint: '#94a3b8' },
      { href: '/library', label: 'Campaign Library', Icon: Library, featureKey: 'campaign_library', tint: '#cbd5e1' },
    ],
  },
];

const AGENT_HREF = '/marketing-agent';

/** Account links live in the Account menu at the bottom (not in the main list). */
const ACCOUNT_LINKS: Array<{ href: string; label: string; featureKey?: string }> = [
  { href: '/settings', label: 'Settings' },
  { href: '/buy-credits', label: 'Plans & Purchases' },
  { href: '/integrations', label: 'Integrations', featureKey: 'integrations' },
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

const PHONE_QUERY = '(max-width: 767.98px)';
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

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
  // Phones (under 768px) get a thin icon strip; the menu button slides the full menu over the page.
  const [isPhone, setIsPhone] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const compact = isPhone ? !phoneOpen : collapsed;
  const [featureAccess, setFeatureAccess] = useState<Record<string, FeatureAccess>>({});
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [soonOpen, setSoonOpen] = useState(false);
  const [accountInitial, setAccountInitial] = useState('');
  const accountRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
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
    setPhoneOpen(false);
  }, [pathname]);

  useIsomorphicLayoutEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const sync = () => {
      setIsPhone(query.matches);
      if (!query.matches) setPhoneOpen(false);
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!phoneOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhoneOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [phoneOpen]);

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

  const isSoon = (item: NavItem) => Boolean(item.comingSoon || (item.featureKey && featureAccess[item.featureKey]?.comingSoon));
  // "Soon" features wait in one small fold at the bottom instead of crowding the list.
  const soonItems = NAV_SECTIONS.flatMap((section) => section.items).filter((item) => itemState(item) === 'visible' && isSoon(item));
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    entries: section.items
      .map((item) => ({ item, state: itemState(item) }))
      .filter(
        (entry): entry is { item: NavItem; state: 'loading' | 'visible' } =>
          entry.state !== 'hidden' && !(entry.state === 'visible' && isSoon(entry.item))
      ),
  })).filter((section) => section.entries.length > 0);
  const accountLinks = ACCOUNT_LINKS.filter((l) => !l.featureKey || itemState({ href: l.href, label: l.label, Icon: Folder, featureKey: l.featureKey }) === 'visible');
  const agentActive = isRouteActive(pathname, AGENT_HREF);

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
      // The folded strip has no room for a text placeholder; the item appears once access is known.
      return compact ? null : <SkeletonNavItem key={item.href} />;
    }

    const active = isRouteActive(pathname, item.href);
    const comingSoon = Boolean(item.comingSoon || (item.featureKey && featureAccess[item.featureKey]?.comingSoon));
    const isReport = item.href === REPORT_ITEM.href;

    return (
      <Link
        key={item.href}
        href={item.href}
        title={compact ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`group flex items-center gap-2.5 rounded-lg transition-colors duration-150 ${
          compact ? 'justify-center px-1.5 py-1.5' : 'px-2 py-1.5'
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
        {item.tint ? (
          <span
            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] transition-colors"
            style={{ background: `${item.tint}${active ? '33' : '1a'}`, color: item.tint }}
          >
            <item.Icon size={15} strokeWidth={1.9} />
          </span>
        ) : (
          <item.Icon size={16} strokeWidth={1.75} className="shrink-0" />
        )}
        {!compact && (
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

  const overlay = isPhone && phoneOpen;

  // Some pages (Create Campaign) set the sidebar's layer themselves; lift it over the dimmed page while open.
  useEffect(() => {
    const el = asideRef.current;
    if (!overlay || !el) return;
    const prev = el.style.zIndex;
    el.style.zIndex = '61';
    return () => {
      el.style.zIndex = prev;
    };
  }, [overlay]);

  return (
    <>
    {overlay && (
      <>
        {/* Keeps the page where it was while the menu slides over it. */}
        <div aria-hidden="true" className="w-14 shrink-0" />
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[60] bg-black/60"
          onClick={() => setPhoneOpen(false)}
        />
      </>
    )}
    <aside
      ref={asideRef}
      className={`flex shrink-0 flex-col transition-[width] duration-200 ease-out ${
        overlay
          ? 'fixed left-0 top-0 z-[61] h-[100dvh] w-[280px] max-w-[85vw] shadow-2xl'
          : `sticky top-0 h-screen self-start ${isPhone ? 'w-14' : compact ? 'w-[72px]' : 'w-[260px] max-md:w-14 max-md:overflow-hidden'}`
      }`}
      style={{
        backgroundColor: SURFACE,
        color: ITEM,
        borderRight: `1px solid ${LINE}`,
      }}
      aria-expanded={!compact}
      data-collapsed={compact ? 'true' : 'false'}
    >
      <div className={`flex items-center ${compact ? 'justify-center px-2' : 'justify-between px-4'} py-4`}>
        {!compact &&
          (onLogoClick ? (
            <button type="button" onClick={onLogoClick} className="rounded-md" aria-label="SkalX">
              <img src="/images/SkalX_Logo.png" alt="SkalX" className="h-5 w-auto object-contain" />
            </button>
          ) : (
            <Link href="/workspace" className="rounded-md" aria-label="SkalX home">
              <img src="/images/SkalX_Logo.png" alt="SkalX" className="h-5 w-auto object-contain" />
            </Link>
          ))}
        <button
          type="button"
          aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => {
            setAccountOpen(false);
            if (isPhone) setPhoneOpen((open) => !open);
            else setCollapsed((open) => !open);
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
        {/* The Marketing Agent: its own highlighted row with the living orb. */}
        <Link
          href={AGENT_HREF}
          title={compact ? 'Marketing Agent' : undefined}
          aria-current={agentActive ? 'page' : undefined}
          className={`group mb-3 block rounded-xl p-px transition-shadow ${agentActive ? 'shadow-[0_0_24px_-6px_rgba(167,139,250,0.55)]' : 'hover:shadow-[0_0_20px_-8px_rgba(167,139,250,0.5)]'}`}
          style={{ background: 'linear-gradient(135deg, rgba(255,201,143,0.55), rgba(247,166,200,0.5), rgba(196,166,242,0.55), rgba(127,159,245,0.6))' }}
        >
          <span
            className={`flex items-center gap-2.5 rounded-[11px] ${compact ? 'justify-center p-1.5' : 'px-2.5 py-2'}`}
            style={{ background: agentActive ? 'linear-gradient(135deg, #2a2236, #1d2238)' : 'linear-gradient(135deg, #201c26, #191b24)' }}
          >
            <AgentOrb size={compact ? 24 : 26} active={agentActive} />
            {!compact && (
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold leading-5" style={{ color: '#ffffff' }}>Marketing Agent</span>
                <span className="block truncate text-[11px] leading-4" style={{ color: '#b9b4c9' }}>Your strategist</span>
              </span>
            )}
          </span>
        </Link>

        {sections.map((section, index) => (
          <div key={section.id} className={index === 0 ? '' : 'mt-3'}>
            {!compact && (
              <div
                className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: LABEL }}
              >
                {section.label}
              </div>
            )}
            {compact && index > 0 && <div className="mx-2 mb-2 border-t" style={{ borderColor: LINE }} />}
            <div className="space-y-0.5">
              {section.entries.map(({ item, state }) => renderItem(item, state))}
            </div>
          </div>
        ))}

        {!compact && soonItems.length > 0 && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setSoonOpen((o) => !o)}
              aria-expanded={soonOpen}
              className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11.5px] transition-colors hover:bg-white/[0.04]"
              style={{ color: LABEL }}
            >
              <ChevronDown size={13} strokeWidth={2} className={`transition-transform ${soonOpen ? '' : '-rotate-90'}`} />
              Coming soon · {soonItems.length}
            </button>
            {soonOpen && <div className="mt-0.5 space-y-0.5 opacity-80">{soonItems.map((item) => renderItem(item, 'visible'))}</div>}
          </div>
        )}
      </nav>

      {(onBrandGuideline || showChatHistory) && (
        <div className="border-t px-2.5 py-2.5" style={{ borderColor: LINE }}>
          {onBrandGuideline && (
            <button
              type="button"
              onClick={() => onBrandGuideline()}
              title={compact ? 'Brand kit' : undefined}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg py-2 text-[13px] transition-colors ${
                compact ? 'justify-center px-2' : 'px-2.5'
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
              {!compact && <span>Brand kit</span>}
            </button>
          )}

          {showChatHistory && (
            <>
              <button
                type="button"
                onClick={() => onNewChat?.()}
                title={compact ? 'New session' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg py-2 text-[13px] font-medium transition-colors ${
                  compact ? 'justify-center px-2' : 'px-2.5'
                }`}
                style={{ color: '#f4f4f5', background: 'rgba(255,255,255,0.04)' }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
              >
                {compact ? <Plus size={16} strokeWidth={1.75} /> : <MessageSquare size={16} strokeWidth={1.75} />}
                {!compact && <span>New session</span>}
              </button>

              {!compact && (
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
        {accountOpen && !compact && (
          <div
            role="menu"
            className="absolute bottom-full left-2.5 right-2.5 z-30 mb-2 overflow-hidden rounded-xl border py-1 shadow-xl"
            style={{ background: '#1c1c21', borderColor: LINE }}
          >
            {accountLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                role="menuitem"
                className="block px-3 py-2 text-[13px] transition-colors hover:bg-white/[0.045]"
                style={{ color: '#f4f4f5' }}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={REPORT_ITEM.href}
              role="menuitem"
              className="block px-3 py-2 text-[13px] transition-colors hover:bg-white/[0.045]"
              style={{ color: '#f4f4f5' }}
            >
              {REPORT_ITEM.label}
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

        {compact ? (
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
    </>
  );
};

export default Sidebar;
