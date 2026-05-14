'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Sparkles, Wand2, X } from 'lucide-react';

type IcebreakerOpener = {
  label: 'Friendly' | 'Biker-specific' | 'Playful';
  message: string;
};

type ApiResponse = {
  openers?: IcebreakerOpener[];
  error?: string;
  rate_limit?: {
    remaining: number;
    reset_at: string;
  };
};

type AIIcebreakerHelperProps = {
  matchId: string;
  onUseMessage: (message: string) => void;
};

export function AIIcebreakerHelper({ matchId, onUseMessage }: AIIcebreakerHelperProps) {
  const [loading, setLoading] = useState(false);
  const [openers, setOpeners] = useState<IcebreakerOpener[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  async function generateOpeners() {
    setLoading(true);
    setExpanded(true);
    try {
      const res = await fetch('/api/ai/icebreaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId }),
      });
      const data = await res.json().catch(() => ({})) as ApiResponse;

      if (!res.ok || !data.openers) {
        toast.error(data.error ?? 'AI icebreaker helper is unavailable right now');
        return;
      }

      setOpeners(data.openers);
      setRemaining(data.rate_limit?.remaining ?? null);
      toast.success('Icebreakers ready');
    } catch {
      toast.error('AI icebreaker helper is unavailable right now');
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

  function useMessage(text: string) {
    onUseMessage(text);
    toast.success('Added to message — edit and send when ready');
  }

  return (
    <div className="shrink-0 border-t border-brand-dark-4 bg-brand-dark-2 px-3 py-2">
      {!expanded ? (
        <button
          type="button"
          onClick={generateOpeners}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-3 py-2 text-xs font-semibold text-brand-orange transition-colors hover:bg-brand-orange/20 disabled:opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {loading ? 'Suggesting openers...' : 'Suggest opener'}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-brand-orange/20 bg-brand-orange/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-brand-orange" /> AI icebreakers
              </p>
              <p className="mt-1 text-xs leading-relaxed text-brand-chrome">
                Suggestions use public profile details only. They are never sent automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg p-1 text-brand-chrome hover:bg-brand-dark-4 hover:text-white"
              aria-label="Hide AI icebreaker suggestions"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={generateOpeners}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-orange px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {loading ? 'Generating...' : openers ? 'Generate new openers' : 'Generate openers'}
          </button>

          {remaining !== null && (
            <p className="text-center text-[11px] text-brand-chrome/70">
              {remaining} AI icebreaker generation{remaining === 1 ? '' : 's'} left today.
            </p>
          )}

          {openers && (
            <div className="space-y-2">
              {openers.map((opener) => (
                <div key={opener.label} className="rounded-xl border border-brand-dark-4 bg-brand-dark-4/70 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-orange">
                    {opener.label}
                  </p>
                  <p className="text-sm leading-relaxed text-brand-chrome">{opener.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyText(opener.message)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-dark-4 bg-brand-dark-3 px-3 py-2 text-xs font-medium text-brand-chrome hover:border-brand-orange/40 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => useMessage(opener.message)}
                      className="rounded-lg bg-brand-orange/15 px-3 py-2 text-xs font-semibold text-brand-orange hover:bg-brand-orange/20"
                    >
                      Use this message
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
