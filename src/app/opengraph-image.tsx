import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'REVdating — The UK Biker Dating App';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Left red accent bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: '#dc2626',
            display: 'flex',
          }}
        />

        {/* Big watermark letter */}
        <div
          style={{
            position: 'absolute',
            right: -60,
            bottom: -80,
            fontSize: 700,
            fontWeight: 900,
            color: 'rgba(220,38,38,0.05)',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          R
        </div>

        {/* Flame shape (CSS) */}
        <div
          style={{
            position: 'absolute',
            right: 100,
            top: 60,
            width: 220,
            height: 400,
            borderRadius: '50% 50% 40% 40% / 60% 60% 40% 40%',
            background: 'linear-gradient(180deg, #FF6B00 0%, #dc2626 60%, #991b1b 100%)',
            opacity: 0.15,
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: 140,
            top: 120,
            width: 140,
            height: 280,
            borderRadius: '50% 50% 40% 40% / 60% 60% 40% 40%',
            background: 'linear-gradient(180deg, #fbbf24 0%, #FF6B00 50%, #dc2626 100%)',
            opacity: 0.12,
            display: 'flex',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '72px 80px 72px 96px',
            gap: 28,
            flex: 1,
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(255,107,0,0.1)',
              border: '1.5px solid rgba(255,107,0,0.3)',
              borderRadius: 999,
              padding: '10px 22px',
              width: 'fit-content',
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#FF6B00',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              🏍️  Biker Dating · Built for UK Riders
            </span>
          </div>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
            <span
              style={{
                fontSize: 112,
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '-0.03em',
              }}
            >
              REV
            </span>
            <span
              style={{
                fontSize: 112,
                fontWeight: 900,
                color: '#dc2626',
                letterSpacing: '-0.03em',
              }}
            >
              dating
            </span>
          </div>

          {/* Tagline */}
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ fontSize: 28, color: '#71717a', fontWeight: 400 }}>
              Find love with someone who
            </span>
            <span style={{ fontSize: 28, color: '#e4e4e7', fontWeight: 600 }}>
              loves the ride.
            </span>
          </div>

          {/* URL strip */}
          <div style={{ display: 'flex', marginTop: 20 }}>
            <span style={{ fontSize: 18, color: '#52525b', letterSpacing: '0.05em' }}>revdating.co.uk</span>
          </div>
        </div>

        {/* Domain bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            right: 56,
            display: 'flex',
          }}
        >
          <span style={{ fontSize: 18, color: '#3f3f46', letterSpacing: '0.02em' }}>
            revdating.co.uk
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
