import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f0f0f',
          borderRadius: 96,
        }}
      >
        {/* Outer flame — orange */}
        <svg width="340" height="380" viewBox="0 0 340 380">
          <path
            d="M170 20 C170 20 260 120 260 210 C260 255 243 282 224 298 C235 262 215 244 215 244 C215 278 191 300 191 330 C191 350 196 366 203 382 C170 420 104 388 104 330 C104 278 134 254 134 254 C119 270 117 288 119 302 C95 286 80 256 80 210 C80 120 170 20 170 20Z"
            fill="#FF6B00"
          />
          {/* Inner flame — red */}
          <path
            d="M170 160 C170 160 208 200 208 240 C208 274 192 294 178 312 C164 330 159 348 159 366 C137 350 126 328 126 302 C126 268 148 244 148 244 C139 258 137 274 139 288 C123 272 116 250 116 228 C116 194 170 160 170 160Z"
            fill="#dc2626"
          />
          {/* Yellow glow core */}
          <ellipse cx="166" cy="326" rx="26" ry="32" fill="#fbbf24" opacity="0.6" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
