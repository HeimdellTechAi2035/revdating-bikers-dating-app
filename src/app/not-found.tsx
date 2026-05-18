import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found — REVdating',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-white px-6 text-center">
      <p className="text-red-500 font-black text-7xl mb-4">404</p>
      <h1 className="text-2xl font-black mb-3">This page took a wrong turn</h1>
      <p className="text-zinc-400 mb-8 max-w-xs">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        href="/"
        className="bg-red-600 hover:bg-red-700 transition-colors text-white font-bold px-6 py-3 rounded-xl"
      >
        Back to REVdating
      </Link>
    </div>
  );
}
