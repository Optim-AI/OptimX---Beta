import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const W = 1200;
const H = 630;

/**
 * Open Graph image: /og?title=…&eyebrow=…
 * Lives outside /api/ so social crawlers that respect robots.txt can fetch it.
 * Warm paper background, ink text, the SkalX accent, matching the website.
 */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') || 'Know what works. Then make it.').slice(0, 110);
  const eyebrow = (searchParams.get('eyebrow') || 'The AI marketing team for D2C brands').slice(0, 60);

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#f6f1e8',
          color: '#17140f',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#1d4ed8', letterSpacing: -1 }}>SkalX</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 4, textTransform: 'uppercase', color: '#1d4ed8' }}>{eyebrow}</div>
          <div style={{ fontSize: title.length > 60 ? 60 : 76, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>
            {title}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#4a4339' }}>
          <span>Research first. Then the ads.</span>
          <span>skalxai.app</span>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}
