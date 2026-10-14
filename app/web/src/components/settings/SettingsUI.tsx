'use client';

import React from 'react';
import Link from 'next/link';
import colors from '@/lib/ui/colors';

export const SETTINGS_TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'business', label: 'Business' },
  { value: 'billing', label: 'Billing' },
  { value: 'security', label: 'Security & Policy' },
] as const;

export type SettingsTabValue = (typeof SETTINGS_TABS)[number]['value'];

export const POLICY_LINKS = [
  { href: '/terms-and-conditions', label: 'Terms & Conditions' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/terms-and-conditions#refund-cancellation', label: 'Refund Policy' },
  { href: '/cpolicy', label: 'Cookie Policy' },
  { href: '/terms-and-conditions#data-handling', label: 'Data Handling & Security' },
  { href: '/terms-and-conditions#ai-usage', label: 'AI Use Disclosure' },
] as const;

export function isSettingsTab(value: unknown): value is SettingsTabValue {
  return SETTINGS_TABS.some((tab) => tab.value === value);
}

export const fieldLabelStyle: React.CSSProperties = {
  color: colors.mutedForeground,
  fontSize: 13,
  fontWeight: 500,
  marginBottom: 6,
  display: 'block',
};

export const fieldInputStyle: React.CSSProperties = {
  background: colors.input,
  color: colors.foreground,
  border: `1px solid ${colors.border}`,
  borderRadius: 10,
  padding: '11px 14px',
  width: '100%',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

export const fieldSelectStyle: React.CSSProperties = {
  ...fieldInputStyle,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
};

type SettingsCardProps = {
  children: React.ReactNode;
  className?: string;
};

export function SettingsCard({ children, className = '' }: SettingsCardProps) {
  return (
    <section
      className={`rounded-2xl p-5 sm:p-7 ${className}`}
      style={{
        background: colors.card,
        border: `1px solid ${colors.border}`,
        boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
      }}
    >
      {children}
    </section>
  );
}

type SettingsSectionHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function SettingsSectionHeader({
  title,
  description,
  action,
}: SettingsSectionHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h3 className="text-lg font-semibold tracking-tight" style={{ color: colors.foreground }}>
          {title}
        </h3>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type SettingsDividerProps = {
  className?: string;
};

export function SettingsDivider({ className = '' }: SettingsDividerProps) {
  return (
    <div
      className={`my-7 ${className}`}
      style={{ borderTop: `1px solid ${colors.border}` }}
    />
  );
}

type ProfileAvatarProps = {
  name?: string | null;
  email?: string | null;
};

export function ProfileAvatar({ name, email }: ProfileAvatarProps) {
  const source = (name || email || 'A').trim();
  const initial = source.charAt(0).toUpperCase() || 'A';

  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold"
      style={{
        background: 'hsl(213 100% 55% / 0.16)',
        color: colors.primary,
        border: `1px solid hsl(213 100% 55% / 0.28)`,
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

type PolicyDocumentLinkProps = {
  href: string;
  label: string;
};

export function PolicyDocumentLink({ href, label }: PolicyDocumentLinkProps) {
  return (
    <Link href={href} className="group block">
      <div
        className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 transition-colors"
        style={{
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.background,
          color: colors.foreground,
        }}
        onMouseEnter={(event) => {
          event.currentTarget.style.borderColor = colors.primary;
          event.currentTarget.style.backgroundColor = 'hsl(213 100% 55% / 0.06)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.borderColor = colors.border;
          event.currentTarget.style.backgroundColor = colors.background;
        }}
      >
        <span className="text-sm font-medium" style={{ color: colors.foreground }}>
          {label}
        </span>
        <span className="text-xs font-medium" style={{ color: colors.mutedForeground }}>
          View
        </span>
      </div>
    </Link>
  );
}

type StatusBadgeProps = {
  status: string;
};

export function PaymentStatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const isComplete = normalized === 'captured' || normalized === 'complete' || normalized === 'paid';
  const isFailed = normalized === 'failed' || normalized === 'cancelled' || normalized === 'canceled';

  return (
    <span
      className="inline-flex rounded-md px-2.5 py-1 text-xs font-semibold capitalize"
      style={{
        background: isComplete
          ? 'hsl(142 76% 36% / 0.15)'
          : isFailed
            ? 'hsl(0 84% 55% / 0.15)'
            : 'hsl(213 100% 55% / 0.15)',
        color: isComplete
          ? colors.green600
          : isFailed
            ? colors.destructive
            : colors.primary,
      }}
    >
      {normalized === 'captured' ? 'Complete' : status}
    </span>
  );
}
