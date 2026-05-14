'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, Copy, Wand2 } from 'lucide-react';

type Suggestions = {
  short_bio: string;
  fun_biker_bio: string;
  serious_dating_bio: string;
  profile_headline: string;
};

type ApiResponse = {
  suggestions?: Suggestions;
  error?: string;
  rate_limit?: {
    remaining: number;
    reset_at: string;
  };
};

type AIProfileHelperProps = {
  onUseBio: (bio: string) => void;
};

const CARDS: Array<{
  key: keyof Suggestions;
  title: string;
  canUseBio: boolean;
}> = [
  { key: 'short_bio', title: 'Short bio', canUseBio: true },
  { key: 'fun_biker_bio', title: 'Fun biker-style bio', canUseBio: true },
  { key: 'serious_dating_bio', title: 'Serious dating bio', canUseBio: true },
  { key: 'profile_headline', title: 'Profile headline', canUseBio: false },
];

export function AIProfileHelper({ onUseBio }: AIProfileHelperProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function generateSuggestions() {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/profile-helper', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as ApiResponse;

      if (!res.ok || !data.suggestions) {
        toast.error(data.error ?? 'AI helper is unavailable right now');
        return;
      }

      setSuggestions(data.suggestions);
      setRemaining(data.rate_limit?.remaining ?? null);
      toast.success('AI suggestions ready');
    } catch {
      toast.error('AI helper is unavailable right now');
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy text');
    }
  }

  function useBio(text: string) {
    onUseBio(text);
    toast.success('Added to bio — review and save when ready');
  }

  return (
    <div className="mt-3 rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-brand-orange/15 p-2 text-brand-orange">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">AI Profile Helper</p>
          <p className="mt-1 text-xs leading-relaxed text-brand-chrome">
            Generate biker-friendly ideas from your own saved profile and bike details. It never uses private messages or other riders&apos; data.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={generateSuggestions}
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Wand2 className="h-4 w-4" />
        {loading ? 'Generating suggestions...' : '✨ Improve my profile with AI'}
      </button>

      {remaining !== null && (
        <p className="text-center text-xs text-brand-chrome/70">
          {remaining} AI profile helper generation{remaining === 1 ? '' : 's'} left today.
        </p>
      )}

      {suggestions && (
        <div className="space-y-3">
          {CARDS.map(({ key, title, canUseBio }) => {
            const text = suggestions[key];
            return (
              <div key={key} className="rounded-xl border border-brand-dark-4 bg-brand-dark-4/70 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  {!canUseBio && (
                    <span className="rounded-full bg-brand-dark-3 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-chrome">
                      Copy-only
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-brand-chrome">{text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(text)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-dark-4 bg-brand-dark-3 px-3 py-2 text-xs font-medium text-brand-chrome hover:border-brand-orange/40 hover:text-white"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  {canUseBio && (
                    <button
                      type="button"
                      onClick={() => useBio(text)}
                      className="rounded-lg bg-brand-orange/15 px-3 py-2 text-xs font-semibold text-brand-orange hover:bg-brand-orange/20"
                    >
                      Use in bio
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
