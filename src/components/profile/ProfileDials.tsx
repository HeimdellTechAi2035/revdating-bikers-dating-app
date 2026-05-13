// Pure SVG gauge instruments — no client interactivity needed.

// ── SVG helpers ──────────────────────────────────────────────────────────────

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  if (sweepDeg <= 0) return '';
  const sweep = Math.min(sweepDeg, 269.99); // avoid degenerate full-circle path
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, startDeg + sweep);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

// ── Gauge layout constants ────────────────────────────────────────────────────

const CX    = 60;   // centre x
const CY    = 60;   // centre y
const R     = 46;   // arc radius
const START = 225;  // start angle (SW, clockwise from top)
const SWEEP = 270;  // total sweep in degrees
const SW    = 10;   // stroke width for the arc track

// ── Single gauge ─────────────────────────────────────────────────────────────

function Gauge({
  value,
  color,
  label,
  displayValue,
  unit,
}: {
  value: number;   // 0–100
  color: string;
  label: string;
  displayValue: string;
  unit: string;
}) {
  const pct    = Math.max(0, Math.min(100, value));
  const filled = (pct / 100) * SWEEP;
  const tip    = polarToCartesian(CX, CY, R - SW / 2 - 4, START + filled);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 104" className="w-full">
        {/* ── Background track ── */}
        <path
          d={arcPath(CX, CY, R, START, SWEEP)}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth={SW}
          strokeLinecap="round"
        />

        {/* ── Filled track ── */}
        {pct > 0 && (
          <path
            d={arcPath(CX, CY, R, START, filled)}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
          />
        )}

        {/* ── Tick marks at 0 / 25 / 50 / 75 / 100 % ── */}
        {[0, 25, 50, 75, 100].map((t) => {
          const angle = START + (t / 100) * SWEEP;
          const inner = polarToCartesian(CX, CY, R - SW - 1, angle);
          const outer = polarToCartesian(CX, CY, R + 4,      angle);
          return (
            <line
              key={t}
              x1={inner.x.toFixed(1)} y1={inner.y.toFixed(1)}
              x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)}
              stroke={t <= pct ? color : '#333'}
              strokeWidth="1.5"
            />
          );
        })}

        {/* ── Needle ── */}
        <line
          x1={CX} y1={CY}
          x2={tip.x.toFixed(2)} y2={tip.y.toFixed(2)}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* ── Hub ── */}
        <circle cx={CX} cy={CY} r="5" fill="#0d0d0d" stroke={color} strokeWidth="1.5" />

        {/* ── Value ── */}
        <text
          x={CX} y={CY - 11}
          textAnchor="middle"
          fill="white"
          fontSize="15"
          fontWeight="bold"
        >
          {displayValue}
        </text>

        {/* ── Unit ── */}
        <text
          x={CX} y={CY - 1}
          textAnchor="middle"
          fill="#555"
          fontSize="7"
          letterSpacing="1"
        >
          {unit}
        </text>

        {/* ── Label in the bottom gap of the arc ── */}
        <text
          x={CX} y={100}
          textAnchor="middle"
          fill="#555"
          fontSize="7.5"
          fontWeight="bold"
          letterSpacing="2"
        >
          {label.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

// ── Profile-completion calculator ─────────────────────────────────────────────

export function calcCompletion(
  profile: {
    bio?:                   string | null;
    city?:                  string | null;
    riding_style?:          string | null;
    years_riding?:          number | null;
    dating_intent?:         string | null;
    music_taste?:           string[] | null;
    children_status?:       string | null;
    smoker?:                boolean | null;
    drinker?:               boolean | null;
    has_passenger_helmet?:  boolean | null;
    attends_rallies?:       boolean | null;
    mood?:                  string | null;
  },
  hasPrimaryPhoto: boolean,
  hasBike: boolean,
): number {
  const checks = [
    !!profile.bio?.trim(),
    !!profile.city,
    !!profile.riding_style,
    profile.years_riding     != null,
    !!profile.dating_intent,
    (profile.music_taste?.length ?? 0) > 0,
    !!profile.children_status,
    profile.smoker           != null,
    profile.drinker          != null,
    profile.has_passenger_helmet != null,
    hasPrimaryPhoto,
    hasBike,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ── Exported widget ───────────────────────────────────────────────────────────

export function ProfileDials({
  revCount,
  completionPct,
}: {
  revCount:      number;
  completionPct: number;
}) {
  // Speed: 50 revs = needle at maximum
  const speedPct = Math.min((revCount / 50) * 100, 100);

  // Oil colour: red when low, amber when partial, green when full
  const oilColor =
    completionPct >= 70 ? '#22c55e' :
    completionPct >= 40 ? '#f59e0b' :
    '#ef4444';

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="p-3 rounded-2xl bg-brand-dark-3 border border-brand-dark-4">
        <Gauge
          value={speedPct}
          color="#F56E0F"
          label="Speed"
          displayValue={String(revCount)}
          unit="REVS"
        />
      </div>
      <div className="p-3 rounded-2xl bg-brand-dark-3 border border-brand-dark-4">
        <Gauge
          value={completionPct}
          color={oilColor}
          label="Oil"
          displayValue={`${completionPct}%`}
          unit="COMPLETE"
        />
      </div>
    </div>
  );
}
