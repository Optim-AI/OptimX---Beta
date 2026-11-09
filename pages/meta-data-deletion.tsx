// /meta-data-deletion — public page for Meta's data deletion flow.
// With ?code=… shows the status of a deletion request; without it, explains how to delete data.
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import colors from '@/lib/ui/colors';
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';

type DeletionStatus = { status: 'received' | 'completed' | 'failed'; requestedAt: string; completedAt: string | null };

const LABEL: Record<DeletionStatus['status'], string> = {
  received: 'Received — deletion in progress',
  completed: 'Completed — your Meta data has been deleted from SkalX',
  failed: 'We hit a problem. Our team has been notified and will finish the deletion manually.',
};

export default function MetaDataDeletionPage() {
  const router = useRouter();
  const code = typeof router.query.code === 'string' ? router.query.code : null;
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/meta-intel/deletion-status?code=${encodeURIComponent(code)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        setStatus((await r.json()) as DeletionStatus);
      })
      .catch(() => setNotFound(true));
  }, [code]);

  return (
    <div className="min-h-screen px-4 py-12" style={{ background: colors.background, color: colors.foreground }}>
      <Head>
        <title>Meta data deletion · SkalX AI</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Delete your Meta data from SkalX</h1>

        {code ? (
          <section className="rounded-2xl p-6" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
            <p className="text-sm" style={{ color: colors.mutedForeground }}>Confirmation code</p>
            <p className="mt-1 font-mono text-lg">{code}</p>
            <p className="mt-4 text-[15px]">
              {status ? LABEL[status.status] : notFound ? 'We could not find this confirmation code.' : 'Checking…'}
            </p>
            {status?.completedAt ? (
              <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                Finished {new Date(status.completedAt).toLocaleString()}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="space-y-3 text-[15px] leading-relaxed">
          <h2 className="text-xl font-semibold">How to delete your data</h2>
          <p><strong>From SkalX:</strong> go to Settings → Integrations → Meta and click <em>Disconnect</em>. This removes our access and permanently deletes your Meta tokens, linked accounts, synced ad and post data, and stored ad images straight away.</p>
          <p><strong>From Facebook:</strong> open Facebook Settings → Security and login → Business integrations (or Apps and websites), remove SkalX AI and choose to delete your data. Facebook tells us and we delete everything automatically; you’ll get a confirmation code to check here.</p>
          <p><strong>By email:</strong> write to <a href={`mailto:${SITE_SUPPORT_EMAIL}`} style={{ color: colors.primary }}>{SITE_SUPPORT_EMAIL}</a> from your account email. We complete requests within 30 days.</p>
          <p>
            See our <Link href="/privacy-policy#meta-api" style={{ color: colors.primary }}>Privacy Policy</Link> for what Meta data we use and why.
          </p>
        </section>
      </div>
    </div>
  );
}
