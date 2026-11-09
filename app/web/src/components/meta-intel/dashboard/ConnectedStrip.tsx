// "Connected to" strip on Ad Performance: which Meta business, ad accounts, Page and Instagram
// account this data comes from, with a link to manage or disconnect them.
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Megaphone, Facebook, Instagram, Settings2 } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import type { MetaStatusView, PublicMetaAsset } from '@/lib/meta/status';

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs" style={{ background: colors.muted, color: colors.foreground }}>
      <span style={{ color: colors.mutedForeground }}>{icon}</span>
      <span style={{ color: colors.mutedForeground }}>{label}</span>
      <span className="truncate font-medium" title={value}>{value}</span>
    </span>
  );
}

const nameOf = (a: PublicMetaAsset) => a.name || a.metaId;
const igName = (a: PublicMetaAsset) => {
  const u = a.metadata?.username;
  return typeof u === 'string' && u ? `@${u}` : nameOf(a);
};

export default function ConnectedStrip() {
  const [status, setStatus] = useState<MetaStatusView | null>(null);

  useEffect(() => {
    let alive = true;
    authFetch('/api/meta-intel/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (alive) setStatus(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!status?.connected) return null;
  const picked = status.assets.filter((a) => a.selected);
  const ads = picked.filter((a) => a.kind === 'ad_account');
  const pages = picked.filter((a) => a.kind === 'page');
  const igs = picked.filter((a) => a.kind === 'ig_account');
  const business = status.businessName
    || ads.map((a) => (a.metadata?.businessName as string | undefined) || '').find(Boolean)
    || null;

  return (
    <section aria-label="Connected Meta accounts" className="mt-5 flex flex-wrap items-center gap-2 rounded-xl p-3"
      style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <span className="mr-1 text-xs font-semibold" style={{ color: colors.foreground }}>
        Connected{status.metaUserName ? ` as ${status.metaUserName}` : ''}
      </span>
      {business ? <Chip icon={<Briefcase size={13} />} label="Business" value={business} /> : null}
      {ads.map((a) => <Chip key={a.metaId} icon={<Megaphone size={13} />} label="Ad account" value={nameOf(a)} />)}
      {pages.map((a) => <Chip key={a.metaId} icon={<Facebook size={13} />} label="Page" value={nameOf(a)} />)}
      {igs.map((a) => <Chip key={a.metaId} icon={<Instagram size={13} />} label="Instagram" value={igName(a)} />)}
      <Link href="/settings?tab=integrations" className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium hover:opacity-80"
        style={{ color: colors.mutedForeground, border: `1px solid ${colors.border}` }}>
        <Settings2 size={13} /> Manage or disconnect
      </Link>
    </section>
  );
}
