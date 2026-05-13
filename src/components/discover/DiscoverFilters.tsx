'use client';

import { useState } from 'react';
import { X, SlidersHorizontal, Check, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatRidingStyle } from '@/lib/utils';
import toast from 'react-hot-toast';

const BIKE_TYPES = [
  'cruiser', 'sport', 'touring', 'adventure', 'dirt',
  'chopper', 'cafe_racer', 'bobber', 'naked', 'scooter', 'electric', 'other',
] as const;

const RIDING_STYLES = BIKE_TYPES; // same values

const DATING_INTENTS = [
  { value: 'serious_relationship', label: 'Serious relationship' },
  { value: 'casual_dating',        label: 'Casual dating' },
  { value: 'riding_partner',       label: 'Riding partner' },
  { value: 'friendship',           label: 'Friendship' },
  { value: 'open_to_anything',     label: 'Open to anything' },
] as const;

const CLUB_TYPES = [
  { value: 'MC',          label: 'MC — Motorcycle Club' },
  { value: 'RC',          label: 'RC — Riding Club' },
  { value: 'independent', label: 'Independent' },
  { value: 'none',        label: 'No club' },
] as const;

export interface ActiveFilters {
  bike_types:     string[];
  riding_styles:  string[];
  dating_intents: string[];
  verified_only:  boolean;
  club_types:     string[];
}

const EMPTY_FILTERS: ActiveFilters = {
  bike_types:     [],
  riding_styles:  [],
  dating_intents: [],
  verified_only:  false,
  club_types:     [],
};

export function hasActiveFilters(f: ActiveFilters) {
  return (
    f.bike_types.length > 0 ||
    f.riding_styles.length > 0 ||
    f.dating_intents.length > 0 ||
    f.verified_only ||
    f.club_types.length > 0
  );
}

interface Props {
  initialFilters: ActiveFilters;
  onApply: (filters: ActiveFilters) => void;
  onClose: () => void;
}

export default function DiscoverFilters({ initialFilters, onApply, onClose }: Props) {
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters);
  const [saving, setSaving]   = useState(false);

  function toggleItem<T extends string>(arr: T[], item: T): T[] {
    return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
  }

  async function apply() {
    setSaving(true);
    try {
      // Persist to server (fire and forget — apply immediately)
      fetch('/api/discover/filters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bike_types:     filters.bike_types.length     ? filters.bike_types     : null,
          riding_styles:  filters.riding_styles.length  ? filters.riding_styles  : null,
          dating_intents: filters.dating_intents.length ? filters.dating_intents : null,
          verified_only:  filters.verified_only,
          club_types:     filters.club_types.length     ? filters.club_types     : null,
        }),
      }).catch(() => {});

      onApply(filters);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function clear() {
    setFilters(EMPTY_FILTERS);
  }

  const activeCount =
    filters.bike_types.length +
    filters.riding_styles.length +
    filters.dating_intents.length +
    (filters.verified_only ? 1 : 0) +
    filters.club_types.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-brand-dark-2 rounded-t-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brand-dark-4" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-brand-dark-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-brand-orange" />
            <h2 className="font-bold text-lg">Advanced Filters</h2>
            {activeCount > 0 && (
              <span className="bg-brand-orange text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {activeCount}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-brand-dark-4 transition-colors">
            <X className="w-5 h-5 text-brand-chrome" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 pb-8">
          {/* Bike type */}
          <FilterSection title="Primary bike type">
            <div className="flex flex-wrap gap-2">
              {BIKE_TYPES.map((bt) => (
                <Chip
                  key={bt}
                  label={formatRidingStyle(bt)}
                  active={filters.bike_types.includes(bt)}
                  onToggle={() =>
                    setFilters((f) => ({ ...f, bike_types: toggleItem(f.bike_types, bt) }))
                  }
                />
              ))}
            </div>
          </FilterSection>

          {/* Riding style */}
          <FilterSection title="Riding style">
            <div className="flex flex-wrap gap-2">
              {RIDING_STYLES.map((rs) => (
                <Chip
                  key={rs}
                  label={formatRidingStyle(rs)}
                  active={filters.riding_styles.includes(rs)}
                  onToggle={() =>
                    setFilters((f) => ({ ...f, riding_styles: toggleItem(f.riding_styles, rs) }))
                  }
                />
              ))}
            </div>
          </FilterSection>

          {/* Dating intent */}
          <FilterSection title="Looking for">
            <div className="flex flex-wrap gap-2">
              {DATING_INTENTS.map((di) => (
                <Chip
                  key={di.value}
                  label={di.label}
                  active={filters.dating_intents.includes(di.value)}
                  onToggle={() =>
                    setFilters((f) => ({
                      ...f,
                      dating_intents: toggleItem(f.dating_intents, di.value),
                    }))
                  }
                />
              ))}
            </div>
          </FilterSection>

          {/* Profile quality */}
          <FilterSection title="Profile quality">
            <button
              onClick={() => setFilters((f) => ({ ...f, verified_only: !f.verified_only }))}
              className={`flex items-center justify-between w-full p-3 rounded-xl border transition-colors ${
                filters.verified_only
                  ? 'bg-brand-orange/10 border-brand-orange/50 text-white'
                  : 'bg-brand-dark-3 border-brand-dark-4 text-brand-chrome'
              }`}
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <Crown className="w-4 h-4 text-brand-orange" />
                Verified riders only
              </span>
              {filters.verified_only && <Check className="w-4 h-4 text-brand-orange" />}
            </button>
          </FilterSection>

          {/* Club type */}
          <FilterSection title="Club association">
            <div className="flex flex-wrap gap-2">
              {CLUB_TYPES.map((ct) => (
                <Chip
                  key={ct.value}
                  label={ct.label}
                  active={filters.club_types.includes(ct.value)}
                  onToggle={() =>
                    setFilters((f) => ({ ...f, club_types: toggleItem(f.club_types, ct.value) }))
                  }
                />
              ))}
            </div>
          </FilterSection>

          {/* Actions */}
          <div className="flex gap-3">
            {activeCount > 0 && (
              <button
                onClick={clear}
                className="flex-1 py-3 rounded-2xl border border-brand-dark-4 text-brand-chrome text-sm font-semibold hover:border-brand-orange/50 transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              onClick={apply}
              disabled={saving}
              className="flex-1 py-3 rounded-2xl bg-brand-orange text-white font-bold hover:bg-brand-orange/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Applying…' : activeCount > 0 ? `Apply ${activeCount} filter${activeCount !== 1 ? 's' : ''}` : 'Apply'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-brand-chrome uppercase tracking-wider mb-2.5">{title}</p>
      {children}
    </div>
  );
}

function Chip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active
          ? 'bg-brand-orange/15 border-brand-orange text-white'
          : 'bg-brand-dark-3 border-brand-dark-4 text-brand-chrome hover:border-brand-orange/50'
      }`}
    >
      {label}
    </button>
  );
}
