'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const TIPS = [
  {
    title: 'Meet in a public place first',
    body: 'For your first meet, choose a busy café, pub, or bike meet — not a private location. Let someone know where you\'re going.',
  },
  {
    title: 'Use the Ride Check-In feature',
    body: 'Before riding with someone new, set up a check-in with your expected return time and emergency contact. We\'ll alert them if you don\'t check back in.',
  },
  {
    title: 'Share your own transport',
    body: 'On early dates, ride your own bike so you can leave independently. Trust your gut — your instincts exist for a reason.',
  },
  {
    title: 'Video call before meeting',
    body: 'A quick video call helps confirm the person is who their profile says. Genuine riders won\'t mind.',
  },
  {
    title: 'Tell a trusted friend',
    body: 'Share the name, photos, and where you\'re meeting with a friend before you go. Check in with them afterwards.',
  },
  {
    title: 'Keep personal info private',
    body: 'Don\'t share your home address, workplace, or daily routine until you\'re comfortable and have built trust over multiple meetings.',
  },
  {
    title: 'Trust your instincts',
    body: 'If something feels off — cancel. A genuine person will understand. Your safety always comes first.',
  },
];

export default function SafetyTips() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="bg-brand-dark-3 border border-brand-dark-4 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-brand-dark-4/30 transition-colors"
      >
        <div>
          <p className="font-semibold text-sm">Safe dating tips</p>
          <p className="text-brand-chrome text-xs mt-0.5">7 tips for staying safe while riding and dating</p>
        </div>
        {open
          ? <ChevronUp   className="w-5 h-5 text-brand-chrome flex-shrink-0" />
          : <ChevronDown className="w-5 h-5 text-brand-chrome flex-shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-brand-dark-4 divide-y divide-brand-dark-4">
          {TIPS.map((tip, i) => (
            <div key={i}>
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand-dark-4/20 transition-colors"
              >
                <span className="text-sm font-medium">{tip.title}</span>
                {expanded === i
                  ? <ChevronUp   className="w-4 h-4 text-brand-chrome flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-brand-chrome flex-shrink-0" />
                }
              </button>
              {expanded === i && (
                <p className="px-4 pb-3 text-brand-chrome text-sm leading-relaxed">
                  {tip.body}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
