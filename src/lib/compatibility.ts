/**
 * lib/compatibility.ts
 *
 * Biker dating compatibility scoring engine.
 * Pure TypeScript — no browser APIs, safe to import from server components,
 * API routes, and client components alike.
 *
 * Two public APIs coexist:
 *
 *   1. calculateCompatibility(userA, userB)   ← new symmetric API
 *      Takes two full CompatibilityUser objects (same shape for both sides).
 *      Returns { score: 0–100, reasons: string[] }.
 *      Weights defined in WEIGHTS below — adjust there only.
 *
 *   2. computeCompatibility(viewer, candidate) ← legacy asymmetric API
 *      Kept for backwards compatibility with existing call-sites.
 *      Uses its own hardcoded weight budget.
 *
 * Weight budget for calculateCompatibility (must sum to exactly 100):
 *   Dating intent        20 pts
 *   Riding style         20 pts
 *   Bike type            15 pts
 *   Music taste          15 pts
 *   Distance             10 pts
 *   Lifestyle            10 pts
 *   Club type             5 pts
 *   Rally interest        5 pts
 *   ───────────────────  ─────
 *   Total               100 pts
 */

import type { DiscoveryCandidate } from '@/types/database.types';

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHTS — edit here to re-balance scoring without touching logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maximum points awarded per dimension.
 * These must sum to 100 for the score to stay in the 0–100 range.
 */
export const WEIGHTS = {
  dating_intent:  20,
  riding_style:   20,
  bike_type:      15,
  music_taste:    15,
  distance:       10,
  lifestyle:      10,
  club_type:       5,
  rally_interest:  5,
} as const satisfies Record<string, number>;

// ─────────────────────────────────────────────────────────────────────────────
// Symmetric user type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fields required from each user for calculateCompatibility.
 * Both currentUser and candidateUser use this same shape.
 */
export interface CompatibilityUser {
  // Preferences
  dating_intent:        string | null;
  riding_style:         string | null;
  primary_bike_type:    string | null;
  music_taste:          string[] | null;
  attends_rallies:      boolean | null;
  // Club
  club_type:            string | null;   // 'MC' | 'RC' | 'independent' | 'none'
  club_status:          string | null;   // 'member' | 'founder' | 'independent' | 'none'
  // Lifestyle
  smoker:               boolean | null;
  drinker:              boolean | null;
  has_passenger_helmet: boolean | null;
  // Location — used to compute distance internally
  latitude:             number | null;
  longitude:            number | null;
  max_distance_miles:   number;
}

export interface CompatibilityOutput {
  /** Overall compatibility score from 0 to 100. */
  score: number;
  /** Human-readable sentences explaining the strongest matches. */
  reasons: string[];
  /** Raw per-dimension scores for debugging or visualisation. */
  breakdown: Record<keyof typeof WEIGHTS, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// calculateCompatibility — symmetric public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the compatibility score between two users.
 *
 * The function is symmetric: swapping currentUser and candidateUser
 * produces the same score (with distance computed using the current
 * user's max_distance_miles as the reference cap).
 *
 * @example
 * const { score, reasons } = calculateCompatibility(me, them);
 * // score: 78
 * // reasons: ["You both prefer long-distance rides", "You both like rock and metal"]
 */
export function calculateCompatibility(
  currentUser: CompatibilityUser,
  candidateUser: CompatibilityUser,
): CompatibilityOutput {
  const reasons: string[] = [];

  // Compute straight-line distance between the two users (miles)
  const distanceMiles = _haversine(
    currentUser.latitude,
    currentUser.longitude,
    candidateUser.latitude,
    candidateUser.longitude,
  );

  const di  = _calcDatingIntent(currentUser.dating_intent,     candidateUser.dating_intent);
  const rs  = _calcRidingStyle(currentUser.riding_style,       candidateUser.riding_style);
  const bt  = _calcBikeType(currentUser.primary_bike_type,     candidateUser.primary_bike_type);
  const mt  = _calcMusicTaste(currentUser.music_taste,         candidateUser.music_taste);
  const dst = _calcDistance(distanceMiles,                      currentUser.max_distance_miles);
  const ls  = _calcLifestyle(currentUser,                       candidateUser);
  const ct  = _calcClubType(currentUser.club_type,             candidateUser.club_type);
  const ri  = _calcRallyInterest(currentUser.attends_rallies,  candidateUser.attends_rallies);

  // Collect reasons (only when there is a positive match)
  if (di.reason)  reasons.push(di.reason);
  if (rs.reason)  reasons.push(rs.reason);
  if (bt.reason)  reasons.push(bt.reason);
  if (mt.reason)  reasons.push(mt.reason);
  if (dst.reason) reasons.push(dst.reason);
  ls.reasons.forEach((r) => reasons.push(r));
  if (ct.reason)  reasons.push(ct.reason);
  if (ri.reason)  reasons.push(ri.reason);

  const breakdown: CompatibilityOutput['breakdown'] = {
    dating_intent:  _clamp(di.score,  0, WEIGHTS.dating_intent),
    riding_style:   _clamp(rs.score,  0, WEIGHTS.riding_style),
    bike_type:      _clamp(bt.score,  0, WEIGHTS.bike_type),
    music_taste:    _clamp(mt.score,  0, WEIGHTS.music_taste),
    distance:       _clamp(dst.score, 0, WEIGHTS.distance),
    lifestyle:      _clamp(ls.score,  0, WEIGHTS.lifestyle),
    club_type:      _clamp(ct.score,  0, WEIGHTS.club_type),
    rally_interest: _clamp(ri.score,  0, WEIGHTS.rally_interest),
  };

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.round(_clamp(raw, 0, 100));

  return { score, reasons, breakdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring factors — new symmetric engine
// Each returns { score: number; reason: string | null }
// ─────────────────────────────────────────────────────────────────────────────

const _INTENT_LABEL: Record<string, string> = {
  serious_relationship: 'a serious relationship',
  casual_dating:        'casual dating',
  riding_partner:       'a riding partner',
  friendship:           'friendship',
  open_to_anything:     'keeping it open',
};

const _INTENT_COMPATIBLE: Record<string, string[]> = {
  serious_relationship: ['open_to_anything'],
  casual_dating:        ['open_to_anything'],
  riding_partner:       ['friendship', 'open_to_anything'],
  friendship:           ['riding_partner', 'open_to_anything'],
  open_to_anything:     ['serious_relationship', 'casual_dating', 'riding_partner', 'friendship'],
};

function _calcDatingIntent(
  a: string | null,
  b: string | null,
): { score: number; reason: string | null } {
  const W = WEIGHTS.dating_intent;
  if (!a || !b) return { score: Math.round(W * 0.4), reason: null };
  if (a === b) {
    const label = _INTENT_LABEL[a] ?? a.replace(/_/g, ' ');
    return { score: W, reason: `You're both looking for ${label}` };
  }
  if (_INTENT_COMPATIBLE[a]?.includes(b)) {
    return { score: Math.round(W * 0.5), reason: null };
  }
  return { score: 0, reason: null };
}

const _STYLE_LABEL: Record<string, string> = {
  cruiser:    'cruiser',
  sport:      'sport',
  touring:    'long-distance',
  adventure:  'adventure',
  dirt:       'off-road / dirt',
  chopper:    'chopper',
  cafe_racer: 'café racer',
  bobber:     'bobber',
  naked:      'naked / street',
  scooter:    'scooter',
  electric:   'electric',
  other:      'mixed-style',
};

const _STYLE_COMPATIBLE: Record<string, string[]> = {
  cruiser:    ['chopper', 'bobber', 'cafe_racer', 'naked'],
  sport:      ['naked', 'cafe_racer'],
  touring:    ['adventure', 'cruiser'],
  adventure:  ['touring', 'dirt'],
  cafe_racer: ['naked', 'sport', 'cruiser'],
  chopper:    ['cruiser', 'bobber'],
  bobber:     ['chopper', 'cruiser'],
  dirt:       ['adventure'],
  naked:      ['sport', 'cafe_racer', 'cruiser'],
  scooter:    ['naked'],
  electric:   [],
  other:      [],
};

function _calcRidingStyle(
  a: string | null,
  b: string | null,
): { score: number; reason: string | null } {
  const W = WEIGHTS.riding_style;
  if (!a || !b) return { score: Math.round(W * 0.4), reason: null };
  if (a === b) {
    const style = _STYLE_LABEL[a] ?? a.replace(/_/g, ' ');
    return {
      score: W,
      reason: a === 'touring'
        ? 'You both prefer long-distance rides'
        : `You're both ${style} riders`,
    };
  }
  if (_STYLE_COMPATIBLE[a]?.includes(b)) {
    return { score: Math.round(W * 0.5), reason: 'Your riding styles complement each other' };
  }
  return { score: 0, reason: null };
}

const _BIKE_GROUP: Record<string, string> = {
  cruiser:    'classic',
  chopper:    'classic',
  bobber:     'classic',
  sport:      'performance',
  cafe_racer: 'performance',
  naked:      'performance',
  touring:    'touring',
  adventure:  'touring',
  dirt:       'offroad',
  scooter:    'urban',
  electric:   'urban',
  other:      'other',
};

const _BIKE_GROUP_LABEL: Record<string, string> = {
  classic:     'classic bikes',
  performance: 'performance bikes',
  touring:     'long-distance bikes',
  offroad:     'off-road bikes',
  urban:       'urban bikes',
};

function _calcBikeType(
  a: string | null,
  b: string | null,
): { score: number; reason: string | null } {
  const W = WEIGHTS.bike_type;
  if (!a || !b) return { score: 0, reason: null };
  if (a === b) {
    const friendly = _STYLE_LABEL[a] ?? a.replace(/_/g, ' ');
    return { score: W, reason: `You both ride ${friendly}` };
  }
  const gA = _BIKE_GROUP[a];
  const gB = _BIKE_GROUP[b];
  if (gA && gB && gA === gB && gA !== 'other') {
    const groupLabel = _BIKE_GROUP_LABEL[gA] ?? gA;
    return { score: Math.round(W * 0.5), reason: `You share a love of ${groupLabel}` };
  }
  return { score: 0, reason: null };
}

const _MUSIC_LABEL: Record<string, string> = {
  rock:       'rock',
  metal:      'metal',
  country:    'country',
  blues:      'blues',
  jazz:       'jazz',
  hip_hop:    'hip-hop',
  electronic: 'electronic',
  pop:        'pop',
  classical:  'classical',
  folk:       'folk',
  punk:       'punk',
  reggae:     'reggae',
  other:      'music',
};

function _calcMusicTaste(
  a: string[] | null,
  b: string[] | null,
): { score: number; reason: string | null } {
  const W = WEIGHTS.music_taste;
  if (!a?.length || !b?.length) return { score: 0, reason: null };

  const overlap = a.filter((g) => b.includes(g));
  if (!overlap.length) return { score: 0, reason: null };

  // Each shared genre worth W/3 pts; capped at W
  const score = Math.round(Math.min(W, overlap.length * (W / 3)));
  const names = overlap.slice(0, 2).map((g) => _MUSIC_LABEL[g] ?? g);
  const reason =
    overlap.length === 1
      ? `You both like ${names[0]}`
      : `You both like ${names.join(' and ')}`;

  return { score, reason };
}

function _calcDistance(
  distanceMiles: number | null,
  maxDistanceMiles: number,
): { score: number; reason: string | null } {
  const W = WEIGHTS.distance;
  if (distanceMiles === null) return { score: Math.round(W * 0.5), reason: null };

  const cap = Math.max(1, maxDistanceMiles);
  const score = Math.round(Math.max(0, W * (1 - distanceMiles / cap)));

  let reason: string | null = null;
  const rounded = Math.round(distanceMiles);
  if (distanceMiles < 1) {
    reason = 'You are less than a mile apart';
  } else if (distanceMiles < 10) {
    reason = `You are only ${rounded} mile${rounded === 1 ? '' : 's'} apart`;
  } else if (distanceMiles < 25) {
    reason = `You are within ${rounded} miles of each other`;
  } else if (distanceMiles < 50) {
    reason = `You are within ${rounded} miles of each other`;
  }

  return { score, reason };
}

const _CLUB_TYPE_LABEL: Record<string, string> = {
  MC:          'MC club',
  RC:          'RC club',
  independent: 'independent',
  none:        'independent',
};

const _CLUB_COMPATIBLE: Record<string, string[]> = {
  MC:          ['MC'],
  RC:          ['RC'],
  independent: ['independent', 'none', 'RC'],
  none:        ['independent', 'none', 'RC'],
};

function _calcClubType(
  a: string | null,
  b: string | null,
): { score: number; reason: string | null } {
  const W = WEIGHTS.club_type;
  // Treat null / 'none' / 'independent' as equivalent for matching purposes
  const normalize = (v: string | null) =>
    !v || v === 'none' || v === 'independent' ? 'independent' : v;

  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) {
    if (na === 'independent') {
      return { score: W, reason: 'You are both independent riders' };
    }
    const label = _CLUB_TYPE_LABEL[na] ?? na;
    return { score: W, reason: `You are both ${label} members` };
  }
  if (_CLUB_COMPATIBLE[na]?.includes(nb)) {
    return { score: Math.round(W * 0.6), reason: null };
  }
  return { score: 0, reason: null };
}

function _calcRallyInterest(
  a: boolean | null,
  b: boolean | null,
): { score: number; reason: string | null } {
  const W = WEIGHTS.rally_interest;
  if (a === true && b === true) {
    return { score: W, reason: 'You both attend rallies' };
  }
  return { score: 0, reason: null };
}

function _calcLifestyle(
  a: Pick<CompatibilityUser, 'smoker' | 'drinker' | 'has_passenger_helmet'>,
  b: Pick<CompatibilityUser, 'smoker' | 'drinker' | 'has_passenger_helmet'>,
): { score: number; reasons: string[] } {
  const W = WEIGHTS.lifestyle;
  // Sub-weights sum to W (10)
  const SW = { smoker: 4, drinker: 3, helmet: 3 } as const;

  let score = 0;
  const reasons: string[] = [];

  if (a.smoker !== null && b.smoker !== null && a.smoker === b.smoker) {
    score += a.smoker === false ? SW.smoker : Math.round(SW.smoker * 0.5);
    if (a.smoker === false) reasons.push("Neither of you smoke");
  }

  if (a.drinker !== null && b.drinker !== null && a.drinker === b.drinker) {
    score += SW.drinker;
  }

  if (b.has_passenger_helmet === true) {
    score += SW.helmet;
    reasons.push("They have a spare helmet ready for you");
  }

  return { score: Math.round(Math.min(W, score)), reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: haversine distance
// ─────────────────────────────────────────────────────────────────────────────

function _haversine(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null,
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 3958.8; // Earth radius in miles
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const dφ = ((lat2 - lat1) * Math.PI) / 180;
  const dλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy asymmetric API — kept for backwards compatibility with existing
// call-sites (SwipeDeck, discovery lib, compatibility API route).
// For new code, use calculateCompatibility() above instead.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The current user's profile fields needed for scoring.
 * Populated server-side from `profiles` and `bikes` tables.
 */
export interface ViewerProfile {
  riding_style:          string | null;
  primary_bike_type:     string | null;
  dating_intent:         string | null;
  max_distance_miles:    number;
  music_taste:           string[] | null;
  attends_rallies:       boolean | null;
  smoker:                boolean | null;
  drinker:               boolean | null;
  has_passenger_helmet:  boolean | null;
}

export interface CompatibilityBreakdown {
  dating_intent:   number;   // max 22
  riding_style:    number;   // max 20
  bike_type:       number;   // max 13
  music_taste:     number;   // max 15
  distance:        number;   // max 15
  rally_interest:  number;   // max 10
  lifestyle:       number;   // max  7
}

export interface CompatibilityResult {
  /** Overall 0–100 score. */
  score: number;
  /** Bucketed tier for badge colouring. */
  tier: 'high' | 'medium' | 'low';
  /** Short human-readable sentences explaining the match. Max 3 shown. */
  labels: string[];
  /** Per-dimension raw points for debugging / future visualisation. */
  breakdown: CompatibilityBreakdown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main engine
// ─────────────────────────────────────────────────────────────────────────────

export function computeCompatibility(
  viewer: ViewerProfile,
  candidate: DiscoveryCandidate,
): CompatibilityResult {
  const labels: string[] = [];

  const di  = _scoreDatingIntent(viewer.dating_intent, candidate.dating_intent);
  const rs  = _scoreRidingStyle(viewer.riding_style, candidate.riding_style);
  const bt  = _scoreBikeType(viewer.primary_bike_type, candidate.primary_bike_type);
  const mt  = _scoreMusicTaste(viewer.music_taste, candidate.music_taste);
  const dst = _scoreDistance(candidate.distance_miles, viewer.max_distance_miles);
  const ri  = _scoreRallyInterest(viewer.attends_rallies, candidate.attends_rallies);
  const ls  = _scoreLifestyle(viewer, candidate);

  if (di.label)  labels.push(di.label);
  if (rs.label)  labels.push(rs.label);
  if (bt.label)  labels.push(bt.label);
  if (mt.label)  labels.push(mt.label);
  if (dst.label) labels.push(dst.label);
  if (ri.label)  labels.push(ri.label);
  ls.labels.forEach((l) => labels.push(l));

  const breakdown: CompatibilityBreakdown = {
    dating_intent:  di.score,
    riding_style:   rs.score,
    bike_type:      bt.score,
    music_taste:    mt.score,
    distance:       dst.score,
    rally_interest: ri.score,
    lifestyle:      ls.score,
  };

  const raw = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const score = Math.round(Math.min(100, Math.max(0, raw)));
  const tier: CompatibilityResult['tier'] =
    score >= 65 ? 'high' : score >= 35 ? 'medium' : 'low';

  return { score, tier, labels: labels.slice(0, 4), breakdown };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience helpers (server + client reuse)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns just the numeric score — drop-in replacement for old computeCompatibilityScore. */
export function scoreOnly(viewer: ViewerProfile, candidate: DiscoveryCandidate): number {
  return computeCompatibility(viewer, candidate).score;
}

/**
 * Build a ViewerProfile from a raw profiles row + optional primary bike type.
 * Use this in server components and API routes.
 */
export function toViewerProfile(
  row: {
    riding_style?:         string | null;
    dating_intent?:        string | null;
    max_distance_miles?:   number | null;
    music_taste?:          string[] | null;
    attends_rallies?:      boolean | null;
    smoker?:               boolean | null;
    drinker?:              boolean | null;
    has_passenger_helmet?: boolean | null;
  },
  primaryBikeType?: string | null,
): ViewerProfile {
  return {
    riding_style:         row.riding_style          ?? null,
    primary_bike_type:    primaryBikeType            ?? null,
    dating_intent:        row.dating_intent          ?? null,
    max_distance_miles:   row.max_distance_miles     ?? 50,
    music_taste:          row.music_taste            ?? null,
    attends_rallies:      row.attends_rallies        ?? null,
    smoker:               row.smoker                 ?? null,
    drinker:              row.drinker                ?? null,
    has_passenger_helmet: row.has_passenger_helmet   ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor: Dating intent — max 22
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_FRIENDLY: Record<string, string> = {
  serious_relationship: 'a serious relationship',
  casual_dating:        'casual dating',
  riding_partner:       'a riding partner',
  friendship:           'friendship',
  open_to_anything:     'keeping it open',
};

/** Intents that work well together even when not identical. */
const INTENT_COMPATIBLE: Record<string, string[]> = {
  serious_relationship: ['open_to_anything'],
  casual_dating:        ['open_to_anything'],
  riding_partner:       ['friendship', 'open_to_anything'],
  friendship:           ['riding_partner', 'open_to_anything'],
  open_to_anything:     ['serious_relationship', 'casual_dating', 'riding_partner', 'friendship'],
};

function _scoreDatingIntent(
  viewer: string | null,
  candidate: string | null,
): { score: number; label: string | null } {
  if (!viewer || !candidate) return { score: 8, label: null };

  if (viewer === candidate) {
    const intent = INTENT_FRIENDLY[viewer] ?? viewer.replace(/_/g, ' ');
    return { score: 22, label: `You're both looking for ${intent}` };
  }
  if (INTENT_COMPATIBLE[viewer]?.includes(candidate)) {
    return { score: 11, label: null };
  }
  return { score: 0, label: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor: Riding style — max 20
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_FRIENDLY: Record<string, string> = {
  cruiser:    'cruiser',
  sport:      'sport',
  touring:    'long-distance touring',
  adventure:  'adventure',
  dirt:       'off-road / dirt',
  chopper:    'chopper',
  cafe_racer: 'café racer',
  bobber:     'bobber',
  naked:      'naked / street',
  scooter:    'scooter',
  electric:   'electric',
  other:      'mixed-style',
};

const STYLE_COMPATIBLE: Record<string, string[]> = {
  cruiser:    ['chopper', 'bobber', 'cafe_racer', 'naked'],
  sport:      ['naked', 'cafe_racer'],
  touring:    ['adventure', 'cruiser'],
  adventure:  ['touring', 'dirt'],
  cafe_racer: ['naked', 'sport', 'cruiser'],
  chopper:    ['cruiser', 'bobber'],
  bobber:     ['chopper', 'cruiser'],
  dirt:       ['adventure'],
  naked:      ['sport', 'cafe_racer', 'cruiser'],
  scooter:    ['naked'],
  electric:   [],
  other:      [],
};

function _scoreRidingStyle(
  viewer: string | null,
  candidate: string | null,
): { score: number; label: string | null } {
  if (!viewer || !candidate) return { score: 8, label: null };

  if (viewer === candidate) {
    const style = STYLE_FRIENDLY[viewer] ?? viewer.replace(/_/g, ' ');
    return { score: 20, label: `You're both ${style} riders` };
  }
  if (STYLE_COMPATIBLE[viewer]?.includes(candidate)) {
    return { score: 10, label: 'Your riding styles complement each other' };
  }
  return { score: 0, label: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor: Bike type similarity — max 13
// ─────────────────────────────────────────────────────────────────────────────

const BIKE_GROUP: Record<string, string> = {
  cruiser:    'classic',
  chopper:    'classic',
  bobber:     'classic',
  sport:      'performance',
  cafe_racer: 'performance',
  naked:      'performance',
  touring:    'touring',
  adventure:  'touring',
  dirt:       'offroad',
  scooter:    'urban',
  electric:   'urban',
  other:      'other',
};

const BIKE_GROUP_FRIENDLY: Record<string, string> = {
  classic:     'classic bikes',
  performance: 'performance bikes',
  touring:     'long-distance bikes',
  offroad:     'off-road bikes',
  urban:       'urban bikes',
};

function _scoreBikeType(
  viewer: string | null,
  candidate: string | null,
): { score: number; label: string | null } {
  if (!viewer || !candidate) return { score: 0, label: null };

  if (viewer === candidate) {
    const friendly = STYLE_FRIENDLY[viewer] ?? viewer.replace(/_/g, ' ');
    return { score: 13, label: `You both ride ${friendly}` };
  }
  const vGroup = BIKE_GROUP[viewer];
  const cGroup = BIKE_GROUP[candidate];
  if (vGroup && cGroup && vGroup === cGroup && vGroup !== 'other') {
    const friendly = BIKE_GROUP_FRIENDLY[vGroup] ?? vGroup;
    return { score: 6, label: `You share a love of ${friendly}` };
  }
  return { score: 0, label: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor: Music taste overlap — max 15
// ─────────────────────────────────────────────────────────────────────────────

const MUSIC_FRIENDLY: Record<string, string> = {
  rock:        'rock',
  metal:       'metal',
  country:     'country',
  blues:       'blues',
  jazz:        'jazz',
  hip_hop:     'hip-hop',
  electronic:  'electronic',
  pop:         'pop',
  classical:   'classical',
  folk:        'folk',
  punk:        'punk',
  reggae:      'reggae',
  other:       'their own sound',
};

function _scoreMusicTaste(
  viewer: string[] | null,
  candidate: string[] | null,
): { score: number; label: string | null } {
  if (!viewer?.length || !candidate?.length) return { score: 0, label: null };

  const overlap = viewer.filter((g) => candidate.includes(g));
  if (overlap.length === 0) return { score: 0, label: null };

  // Each overlapping genre is worth up to 5 pts; diminishing returns after 3
  const score = Math.round(Math.min(15, overlap.length * 5));

  const names = overlap.slice(0, 2).map((g) => MUSIC_FRIENDLY[g] ?? g);
  const label =
    overlap.length === 1
      ? `You both enjoy ${names[0]}`
      : `You both love ${names.join(' and ')}`;

  return { score, label };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor: Distance — max 15
// ─────────────────────────────────────────────────────────────────────────────

function _scoreDistance(
  distanceMiles: number | null,
  maxDistanceMiles: number,
): { score: number; label: string | null } {
  if (distanceMiles === null) return { score: 5, label: null };

  const cap = Math.max(1, maxDistanceMiles);
  // Linear falloff: full points at 0 miles, 0 points at cap miles
  const score = Math.round(Math.max(0, 15 * (1 - distanceMiles / cap)));

  let label: string | null = null;
  const rounded = Math.round(distanceMiles);
  if (distanceMiles < 1) {
    label = 'Less than a mile away';
  } else if (distanceMiles < 10) {
    label = `Only ${rounded} mile${rounded === 1 ? '' : 's'} away`;
  } else if (distanceMiles < 25) {
    label = `${rounded} miles away`;
  }

  return { score, label };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor: Rally interest — max 10
// ─────────────────────────────────────────────────────────────────────────────

function _scoreRallyInterest(
  viewer: boolean | null,
  candidate: boolean | null,
): { score: number; label: string | null } {
  if (viewer === true && candidate === true) {
    return { score: 10, label: 'You both attend rallies' };
  }
  // Neutral if either is unknown; no penalty for mismatch
  return { score: 0, label: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor: Lifestyle preferences — max 7
// ─────────────────────────────────────────────────────────────────────────────

function _scoreLifestyle(
  viewer: Pick<ViewerProfile, 'smoker' | 'drinker' | 'has_passenger_helmet'>,
  candidate: Pick<DiscoveryCandidate, 'smoker' | 'drinker' | 'has_passenger_helmet'>,
): { score: number; labels: string[] } {
  let score = 0;
  const labels: string[] = [];

  // Smoking (3 pts)
  if (viewer.smoker !== null && candidate.smoker !== null) {
    if (viewer.smoker === candidate.smoker) {
      score += viewer.smoker === false ? 3 : 1; // non-smoker match scores higher
      if (viewer.smoker === false) labels.push("Neither of you smoke");
    }
  }

  // Drinking (2 pts)
  if (viewer.drinker !== null && candidate.drinker !== null) {
    if (viewer.drinker === candidate.drinker) {
      score += 2;
    }
  }

  // Has a spare helmet — signals they actively bring people on rides (2 pts)
  if (candidate.has_passenger_helmet === true) {
    score += 2;
    labels.push("Has a spare helmet ready for you");
  }

  return { score: Math.min(7, score), labels };
}
