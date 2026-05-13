'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Bot, Clipboard, Sparkles, X } from 'lucide-react';

type RiskLevel = 'low' | 'medium' | 'high';
type Category =
  | 'harassment'
  | 'threat'
  | 'hate_or_abuse'
  | 'sexual_pressure'
  | 'scam_like'
  | 'money_request'
  | 'suspicious_link'
  | 'impersonation'
  | 'fake_profile'
  | 'underage_concern'
  | 'unsafe_meetup_pressure'
  | 'spam'
  | 'other';
type RecommendedAction =
  | 'no_action'
  | 'review_manually'
  | 'warn_user'
  | 'restrict_account'
  | 'suspend_account'
  | 'escalate';

type ModerationSummary = {
  summary: string;
  risk_level: RiskLevel;
  categories: Category[];
  recommended_action: RecommendedAction;
  evidence_to_check: string[];
  admin_notes: string;
  user_facing_message_draft: string | null;
};

type ApiResponse = Partial<ModerationSummary> & {
  error?: string;
  rate_limit?: {
    remaining: number;
    reset_at: string;
  };
};

type AIReportModerationSummaryProps = {
  reportId: string;
};

const RISK_LABELS: Record<RiskLevel, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
};

const CATEGORY_LABELS: Record<Category, string> = {
  harassment: 'Harassment',
  threat: 'Threat',
  hate_or_abuse: 'Hate or abuse',
  sexual_pressure: 'Sexual pressure',
  scam_like: 'Scam-like',
  money_request: 'Money request',
  suspicious_link: 'Suspicious link',
  impersonation: 'Impersonation',
  fake_profile: 'Fake profile',
  underage_concern: 'Underage concern',
  unsafe_meetup_pressure: 'Unsafe meetup pressure',
  spam: 'Spam',
  other: 'Other',
};

const ACTION_LABELS: Record<RecommendedAction, string> = {
  no_action: 'No action',
  review_manually: 'Review manually',
  warn_user: 'Consider warning user',
  restrict_account: 'Consider restricting account',
  suspend_account: 'Consider suspending account',
  escalate: 'Escalate',
};

export function AIReportModerationSummary({ reportId }: AIReportModerationSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ModerationSummary | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function generateSummary() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/ai/moderation-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: reportId }),
      });
      const data = await res.json().catch(() => ({})) as ApiResponse;

      if (!res.ok || !isModerationSummary(data)) {
        toast.error(data.error ?? 'AI moderation assistant is unavailable right now');
        return;
      }

      setSummary(data);
      setRemaining(data.rate_limit?.remaining ?? null);
      toast.success('AI moderation summary ready');
    } catch {
      toast.error('AI moderation assistant is unavailable right now');
    } finally {
      setLoading(false);
    }
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  }

  return (
    <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="h-4 w-4 text-purple-300" /> AI moderation assistant
          </p>
          <p className="mt-1 text-xs leading-relaxed text-brand-chrome">
            Recommendation only. No report status, account, warning, or admin action is changed automatically.
          </p>
        </div>
        {summary && (
          <button
            type="button"
            onClick={() => setSummary(null)}
            className="rounded-lg p-1 text-brand-chrome hover:bg-brand-dark-4 hover:text-white"
            aria-label="Hide AI moderation summary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={generateSummary}
        disabled={loading}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 px-3 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {loading ? 'Generating summary...' : summary ? 'Generate new AI moderation summary' : 'Generate AI moderation summary'}
      </button>

      {remaining !== null && (
        <p className="mt-2 text-center text-[11px] text-brand-chrome/70">
          {remaining} AI moderation summar{remaining === 1 ? 'y' : 'ies'} left this hour.
        </p>
      )}

      {summary && (
        <div className="mt-3 space-y-3 rounded-xl border border-brand-dark-4 bg-brand-dark-4/70 p-3 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBadgeClass(summary.risk_level)}`}>
              {RISK_LABELS[summary.risk_level]}
            </span>
            <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-chrome">
              {ACTION_LABELS[summary.recommended_action]}
            </span>
          </div>

          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-chrome/70">Summary</p>
            <p className="leading-relaxed text-white">{summary.summary}</p>
          </section>

          {summary.categories.length > 0 && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-chrome/70">Categories</p>
              <div className="flex flex-wrap gap-1.5">
                {summary.categories.map((category) => (
                  <span key={category} className="rounded-full bg-brand-dark-3 px-2 py-0.5 text-[10px] font-semibold text-brand-chrome">
                    {CATEGORY_LABELS[category]}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-chrome/70">Evidence to check</p>
            <ul className="list-disc space-y-1 pl-5 text-brand-chrome">
              {summary.evidence_to_check.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>

          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-chrome/70">Admin notes</p>
            <p className="leading-relaxed text-brand-chrome">{summary.admin_notes}</p>
          </section>

          {summary.user_facing_message_draft && (
            <section className="rounded-lg border border-brand-dark-4 bg-brand-dark-3 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-chrome/70">
                  Optional warning draft
                </p>
                <button
                  type="button"
                  onClick={() => copyText(summary.user_facing_message_draft ?? '', 'Warning draft')}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-purple-300 hover:bg-purple-400/10"
                >
                  <Clipboard className="h-3 w-3" /> Copy
                </button>
              </div>
              <p className="text-xs leading-relaxed text-brand-chrome">{summary.user_facing_message_draft}</p>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function isModerationSummary(data: ApiResponse): data is ModerationSummary & ApiResponse {
  return (
    typeof data.summary === 'string' &&
    ['low', 'medium', 'high'].includes(String(data.risk_level)) &&
    Array.isArray(data.categories) &&
    typeof data.recommended_action === 'string' &&
    Array.isArray(data.evidence_to_check) &&
    typeof data.admin_notes === 'string' &&
    (typeof data.user_facing_message_draft === 'string' || data.user_facing_message_draft === null)
  );
}

function riskBadgeClass(risk: RiskLevel) {
  if (risk === 'high') return 'bg-red-500/10 text-red-400 border border-red-500/20';
  if (risk === 'medium') return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
  return 'bg-green-500/10 text-green-400 border border-green-500/20';
}
