import React, { useState } from 'react';
import { Instagram, Facebook, ExternalLink, ImageOff } from 'lucide-react';
import colors from '@/lib/ui/colors';
import type { OrganicPost } from '@/lib/meta-intel/summary';
import { count } from './format';

function PostImage({ url }: { url: string | null }) {
  const [broken, setBroken] = useState(false);
  return url && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setBroken(true)} className="aspect-square w-full rounded-lg object-cover" style={{ background: colors.muted }} />
  ) : (
    <div className="flex aspect-square w-full items-center justify-center rounded-lg" style={{ background: colors.muted, color: colors.mutedForeground }}><ImageOff size={20} /></div>
  );
}

export default function TopPosts({ posts, hasOrganicAccounts }: { posts: OrganicPost[]; hasOrganicAccounts: boolean }) {
  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>Top organic posts</h2>
      <p className="mb-4 text-xs" style={{ color: colors.mutedForeground }}>Posts published in this period, ranked by likes, comments, saves and shares.</p>
      {posts.length === 0 ? (
        <p className="py-6 text-center text-sm" style={{ color: colors.mutedForeground }}>
          {hasOrganicAccounts ? 'No posts were published in this period.' : 'Link your Facebook Page or Instagram in Settings → Integrations to see your top posts.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {posts.map((p) => (
            <a key={p.postId} href={p.permalink ?? undefined} target="_blank" rel="noopener noreferrer" className="group block rounded-xl p-2" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
              <PostImage url={p.thumbnailUrl} />
              <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: colors.mutedForeground }}>
                {p.platform === 'instagram' ? <Instagram size={12} aria-label="Instagram" /> : <Facebook size={12} aria-label="Facebook" />}
                {p.postedAt ? new Date(p.postedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}
                {p.permalink ? <ExternalLink size={11} className="ml-auto opacity-60 group-hover:opacity-100" aria-hidden /> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-xs" style={{ color: colors.foreground }}>{p.caption || 'No caption'}</p>
              <p className="mt-1.5 text-xs tabular-nums" style={{ color: colors.secondaryForeground }}>
                {count(p.engagement)} engagements{p.views !== null ? ` · ${count(p.views, { compact: true })} views` : p.reach !== null ? ` · ${count(p.reach, { compact: true })} reached` : ''}
              </p>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
