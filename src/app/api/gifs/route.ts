import { NextRequest, NextResponse } from 'next/server';

// Tenor v1 — demo key works without registration
const TENOR_KEY = process.env.TENOR_API_KEY ?? 'LIVDSRZULELA';
const LIMIT = 24;

export async function GET(request: NextRequest) {
  const q = new URL(request.url).searchParams.get('q')?.trim();

  const endpoint = q
    ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=${LIMIT}&contentfilter=medium`
    : `https://g.tenor.com/v1/trending?key=${TENOR_KEY}&limit=${LIMIT}&contentfilter=medium`;

  try {
    const res = await fetch(endpoint, { next: { revalidate: 60 } });
    if (!res.ok) return NextResponse.json({ gifs: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gifs = (json.results ?? []).map((g: any) => {
      const media  = g.media?.[0] ?? {};
      const full   = media.mediumgif?.url ?? media.gif?.url ?? '';
      const thumb  = media.tinygif?.url   ?? full;
      return {
        id:          g.id,
        title:       g.content_description ?? '',
        url:         full,
        preview_url: thumb,
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }).filter((g: any) => g.url);

    return NextResponse.json({ gifs });
  } catch {
    return NextResponse.json({ gifs: [] });
  }
}
