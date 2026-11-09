import dynamic from 'next/dynamic';
import type { GetServerSideProps } from 'next';
import { UGC_STUDIO_LIVE } from '@/lib/creative-studio/commercial-production/campaign/ugc-presets';

/**
 * Named page component (not `export default dynamic(...)`) so Fast Refresh can
 * remount without falling into a full-reload loop.
 * Client-only load avoids Sidebar/zustand persist hydration mismatches.
 */
const VideoSessionPageClient = dynamic(
  () => import('@/app/web/src/components/creative-studio/VideoSessionPageClient'),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-screen flex items-center justify-center app-page"
        style={{ backgroundColor: '#0B0B0F' }}
      >
        <div className="flex items-center gap-3" style={{ color: '#8B8B98' }}>
          <div
            className="animate-spin rounded-full h-6 w-6 border-2 border-t-transparent"
            style={{ borderColor: '#333', borderTopColor: '#A855F7' }}
          />
          <span>Loading studio...</span>
        </div>
      </div>
    ),
  }
);

/** Keep the page dynamic so `?id=` is available via router on first paint. */
export const getServerSideProps: GetServerSideProps = async () =>
  // Paused: send anyone with an old link back to the "Coming soon" page.
  UGC_STUDIO_LIVE ? { props: {} } : { redirect: { destination: '/ugc-studio', permanent: false } };

export default function UgcStudioVideoPage() {
  return <VideoSessionPageClient studio="ugc" />;
}
