import dynamic from 'next/dynamic';
import type { GetServerSideProps } from 'next';

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
export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

export default function BrandStudioVideoPage() {
  return <VideoSessionPageClient />;
}
