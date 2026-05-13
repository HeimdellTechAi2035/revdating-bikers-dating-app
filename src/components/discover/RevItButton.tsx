'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gauge, Loader2 } from 'lucide-react';

/**
 * Synthesises a short engine-rev sound using the Web Audio API.
 * No audio files — no uploads — no external assets.
 * The sound: sawtooth oscillator with overdrive that ramps up then fades.
 */
function playEngineRev() {
  try {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const distortion = ctx.createWaveShaper();

    // Build a mild-overdrive waveshaper curve
    const samples = 256;
    const k = 180;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((Math.PI + k) * x) / (Math.PI + k * Math.abs(x));
    }
    distortion.curve = curve;

    const t = ctx.currentTime;

    // Sawtooth = engine-like tone
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, t);
    // Rev up quickly
    osc.frequency.exponentialRampToValueAtTime(340, t + 0.13);
    // Then settle / fade out
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.55);

    // Envelope: quick attack, slow release
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.38, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.72);

    osc.connect(distortion);
    distortion.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.75);
  } catch {
    // Silently ignore — AudioContext may be blocked on some browsers
  }
}

// ── Throttle rev animation keyframes ──────────────────────────────────────────

/** Rapid shake + scale pulse to simulate a throttle snap */
const revAnimation = {
  x: [0, -4, 4, -3, 3, -1, 1, 0],
  scale: [1, 1.18, 1.12, 1.16, 1.1, 1.05, 1.02, 1],
  rotate: [0, -8, 8, -5, 5, -2, 2, 0],
};

// ── Component ─────────────────────────────────────────────────────────────────

interface RevItButtonProps {
  onClick: () => void;
  disabled: boolean;
  creditsRemaining: number;
  loading?: boolean;
}

export function RevItButton({ onClick, disabled, creditsRemaining, loading = false }: RevItButtonProps) {
  const [isRevving, setIsRevving] = useState(false);

  function handleClick() {
    if (disabled || isRevving) return;
    setIsRevving(true);
    playEngineRev();
    onClick();
    // Reset animation state after the animation completes
    setTimeout(() => setIsRevving(false), 750);
  }

  return (
    <div className="relative flex items-center justify-center">
      {/* Expanding ripple ring */}
      <AnimatePresence>
        {isRevving && (
          <motion.span
            key="ripple"
            className="absolute w-12 h-12 rounded-full border-2 border-orange-400 pointer-events-none"
            initial={{ scale: 1, opacity: 0.9 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{}}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* "REV IT!" floating label */}
      <AnimatePresence>
        {isRevving && (
          <motion.span
            key="rev-label"
            className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-black text-orange-400 uppercase tracking-widest pointer-events-none select-none"
            initial={{ y: 0, opacity: 1 }}
            animate={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
          >
            REV IT! 🏍️
          </motion.span>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        onClick={handleClick}
        disabled={disabled}
        aria-label={`Rev It — ${creditsRemaining} credit${creditsRemaining !== 1 ? 's' : ''} remaining`}
        title="Rev It"
        className={[
          'w-12 h-12 rounded-full bg-brand-dark-3 border-2 flex items-center justify-center shadow-lg',
          'transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
          isRevving
            ? 'border-red-500 bg-red-500/15'
            : 'border-orange-500/40 hover:border-orange-400 hover:bg-orange-500/10',
        ].join(' ')}
        animate={isRevving ? revAnimation : { x: 0, scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        whileHover={!disabled && !isRevving ? { scale: 1.08 } : {}}
        whileTap={!disabled ? { scale: 0.92 } : {}}
      >
        {loading
          ? <Loader2 size={20} className="text-orange-400 animate-spin" />
          : <Gauge size={20} className={isRevving ? 'text-red-400' : 'text-orange-400'} />}
      </motion.button>
    </div>
  );
}
