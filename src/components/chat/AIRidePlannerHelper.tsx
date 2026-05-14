'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Bike, Copy, MapPinned, Route, Wand2, X } from 'lucide-react';

type RideLength = 'short' | 'half_day' | 'full_day';
type RideVibe = 'coffee' | 'scenic' | 'food' | 'relaxed' | 'adventure';
type MeetupType = 'public_cafe' | 'scenic_stop' | 'food_stop' | 'public_landmark' | 'relaxed_meetup';

type RidePlanIdea = {
  title: string;
  summary: string;
  ride_length: RideLength;
  meetup_type: MeetupType;
  safety_note: string;
  message_draft: string;
};

type ApiResponse = {
  ideas?: RidePlanIdea[];
  error?: string;
  rate_limit?: {
    remaining: number;
    reset_at: string;
  };
};

type AIRidePlannerHelperProps = {
  matchId: string;
  onUseMessage: (message: string) => void;
};

const RIDE_LENGTH_LABELS: Record<RideLength, string> = {
  short: 'Short',
  half_day: 'Half day',
  full_day: 'Full day',
};

const VIBE_LABELS: Record<RideVibe, string> = {
  coffee: 'Coffee',
  scenic: 'Scenic',
  food: 'Food',
  relaxed: 'Relaxed',
  adventure: 'Adventure',
};

const MEETUP_TYPE_LABELS: Record<MeetupType, string> = {
  public_cafe: 'Public café',
  scenic_stop: 'Scenic stop',
  food_stop: 'Food stop',
  public_landmark: 'Public landmark',
  relaxed_meetup: 'Relaxed meetup',
};

export function AIRidePlannerHelper({ matchId, onUseMessage }: AIRidePlannerHelperProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rideLength, setRideLength] = useState<RideLength>('short');
  const [vibe, setVibe] = useState<RideVibe>('coffee');
  const [ideas, setIdeas] = useState<RidePlanIdea[] | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function generateIdeas() {
    setLoading(true);
    setExpanded(true);
    try {
      const res = await fetch('/api/ai/ride-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: matchId,
          ride_length: rideLength,
          vibe,
        }),
      });
      const data = await res.json().catch(() => ({})) as ApiResponse;

      if (!res.ok || !data.ideas) {
        toast.error(data.error ?? 'AI ride planner is unavailable right now');
        return;
      }

      setIdeas(data.ideas);
      setRemaining(data.rate_limit?.remaining ?? null);
      toast.success('Ride-date ideas ready');
    } catch {
      toast.error('AI ride planner is unavailable right now');
    } finally {
      setLoading(false);
    }
  }

  async function copyPlan(idea: RidePlanIdea) {
    const text = [
      idea.title,
      idea.summary,
      `Ride length: ${RIDE_LENGTH_LABELS[idea.ride_length]}`,
      `Meetup: ${MEETUP_TYPE_LABELS[idea.meetup_type]}`,
      `Safety note: ${idea.safety_note}`,
      `Message draft: ${idea.message_draft}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Ride plan copied');
    } catch {
      toast.error('Could not copy ride plan');
    }
  }

  function useMessageDraft(message: string) {
    onUseMessage(message);
    toast.success('Draft added — edit and send when ready');
  }

  return (
    <div className="shrink-0 border-t border-brand-dark-4 bg-brand-dark-2 px-3 py-2">
      {!expanded ? (
        <button
          type="button"
          onClick={generateIdeas}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-blue-400/20 disabled:opacity-60"
        >
          <Route className="h-3.5 w-3.5" />
          {loading ? 'Planning...' : 'Plan a ride date'}
        </button>
      ) : (
        <div className="space-y-3 rounded-xl border border-blue-400/20 bg-blue-400/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-white">
                <MapPinned className="h-4 w-4 text-blue-300" /> AI ride date planner
              </p>
              <p className="mt-1 text-xs leading-relaxed text-brand-chrome">
                Uses general public profile and city/country context only. Nothing is saved, sent, or scheduled automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg p-1 text-brand-chrome hover:bg-brand-dark-4 hover:text-white"
              aria-label="Hide AI ride date planner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-brand-chrome">
              Ride length
              <select
                value={rideLength}
                onChange={(e) => setRideLength(e.target.value as RideLength)}
                className="mt-1 w-full rounded-xl border border-brand-dark-4 bg-brand-dark-3 px-3 py-2 text-xs text-white outline-none focus:border-blue-300/60"
              >
                {Object.entries(RIDE_LENGTH_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-brand-chrome">
              Vibe
              <select
                value={vibe}
                onChange={(e) => setVibe(e.target.value as RideVibe)}
                className="mt-1 w-full rounded-xl border border-brand-dark-4 bg-brand-dark-3 px-3 py-2 text-xs text-white outline-none focus:border-blue-300/60"
              >
                {Object.entries(VIBE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={generateIdeas}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {loading ? 'Generating...' : ideas ? 'Generate new ride ideas' : 'Generate ride ideas'}
          </button>

          {remaining !== null && (
            <p className="text-center text-[11px] text-brand-chrome/70">
              {remaining} AI ride planner generation{remaining === 1 ? '' : 's'} left today.
            </p>
          )}

          {ideas && (
            <div className="space-y-2">
              {ideas.map((idea) => (
                <div key={`${idea.title}-${idea.meetup_type}`} className="rounded-xl border border-brand-dark-4 bg-brand-dark-4/70 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-300">
                      <Bike className="h-3 w-3" /> {RIDE_LENGTH_LABELS[idea.ride_length]}
                    </span>
                    <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-chrome">
                      {MEETUP_TYPE_LABELS[idea.meetup_type]}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">{idea.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-brand-chrome">{idea.summary}</p>
                  <p className="mt-2 rounded-lg bg-brand-dark-3 px-3 py-2 text-xs leading-relaxed text-brand-chrome">
                    Safety: {idea.safety_note}
                  </p>
                  <div className="mt-2 rounded-lg border border-brand-dark-4 bg-brand-dark-3 px-3 py-2">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-brand-chrome/70">Message draft</p>
                    <p className="text-xs leading-relaxed text-brand-chrome">{idea.message_draft}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => copyPlan(idea)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-dark-4 bg-brand-dark-3 px-3 py-2 text-xs font-medium text-brand-chrome hover:border-blue-300/40 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy plan
                    </button>
                    <button
                      type="button"
                      onClick={() => useMessageDraft(idea.message_draft)}
                      className="rounded-lg bg-blue-400/15 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-400/20"
                    >
                      Use message draft
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
