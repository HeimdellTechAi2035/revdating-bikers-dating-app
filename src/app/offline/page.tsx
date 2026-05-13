'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-8">
        <span className="font-display text-4xl font-black tracking-widest">
          <span className="text-white">REV</span>
          <span className="text-red-600">MATCH</span>
        </span>
      </div>

      {/* Wheel icon */}
      <div className="w-24 h-24 rounded-full border-4 border-zinc-700 flex items-center justify-center mb-8">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-3">You're offline</h1>
      <p className="text-zinc-400 text-sm max-w-xs mb-8">
        Check your connection and try again. Your matches and messages will be waiting when you're back on the road.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
