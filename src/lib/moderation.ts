import { ModerationResult } from '@/types';

const SIGHTENGINE_URL = 'https://api.sightengine.com/1.0/check.json';
const TIMEOUT_MS = 8000;

// Models to check: nudity, weapons, offensive content, gore
const MODELS = 'nudity-2.1,weapon,offensive,gore-2.0,text';

export async function moderateImageUrl(imageUrl: string): Promise<ModerationResult> {
  const { SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET } = process.env;

  if (!SIGHTENGINE_API_USER || !SIGHTENGINE_API_SECRET) {
    console.warn('[moderation] Sightengine credentials missing — photo left pending for manual admin review');
    return { approved: false, provider: 'none', response: {} };
  }

  const params = new URLSearchParams({
    url: imageUrl,
    models: MODELS,
    api_user: SIGHTENGINE_API_USER,
    api_secret: SIGHTENGINE_API_SECRET,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: Record<string, unknown>;

  try {
    const res = await fetch(`${SIGHTENGINE_URL}?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Sightengine returned ${res.status}`);
    }

    raw = await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.error('Moderation request failed:', err);
    // Fail open with pending status — admin can manually review
    return {
      approved: false,
      provider: 'sightengine',
      response: { error: String(err) },
      rejected_reason: 'Moderation check failed — pending manual review',
    };
  }

  clearTimeout(timer);

  const rejected_reason = evaluateResponse(raw);

  return {
    approved: rejected_reason === undefined,
    provider: 'sightengine',
    response: raw,
    rejected_reason,
  };
}

function evaluateResponse(r: Record<string, unknown>): string | undefined {
  // Nudity
  const nudity = r['nudity'] as Record<string, number> | undefined;
  if (nudity) {
    if ((nudity['raw'] ?? 0) > 0.65) return 'Explicit nudity detected';
    if ((nudity['partial'] ?? 0) > 0.80) return 'Partial nudity detected';
  }

  // Gore
  const gore = r['gore'] as Record<string, number> | undefined;
  if (gore && (gore['prob'] ?? 0) > 0.65) return 'Graphic/gore content detected';

  // Weapons
  if ((r['weapon'] as number | undefined) ?? 0 > 0.80) return 'Weapon detected';

  // Offensive / hate symbols
  const offensive = r['offensive'] as Record<string, number> | undefined;
  if (offensive && (offensive['prob'] ?? 0) > 0.70) return 'Offensive content detected';

  return undefined;
}

// Moderate an image already in Supabase Storage using its public URL
export async function moderateStorageImage(
  publicUrl: string
): Promise<ModerationResult> {
  return moderateImageUrl(publicUrl);
}

// ---------------------------------------------------------------------------
// Selfie face-detection check
// ---------------------------------------------------------------------------

export interface SelfieCheckResult {
  hasFace: boolean;
  faceCount: number;
  /** User-facing rejection reason when hasFace is false */
  reason?: string;
  /** Raw Sightengine response for audit */
  response?: Record<string, unknown>;
}

/**
 * Checks that a selfie contains at least one clearly visible face.
 * Fails open (hasFace: true) when Sightengine credentials are absent or the
 * provider errors — the photo falls through to manual admin review.
 */
export async function checkSelfie(imageUrl: string): Promise<SelfieCheckResult> {
  const { SIGHTENGINE_API_USER, SIGHTENGINE_API_SECRET } = process.env;

  if (!SIGHTENGINE_API_USER || !SIGHTENGINE_API_SECRET) {
    console.warn('[moderation] Sightengine credentials missing — auto-passing selfie face check');
    return { hasFace: true, faceCount: 1 };
  }

  const params = new URLSearchParams({
    url:        imageUrl,
    models:     'face',
    api_user:   SIGHTENGINE_API_USER,
    api_secret: SIGHTENGINE_API_SECRET,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let raw: Record<string, unknown>;

  try {
    const res = await fetch(`${SIGHTENGINE_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Sightengine returned ${res.status}`);
    raw = await res.json();
  } catch (err) {
    clearTimeout(timer);
    console.warn('[moderation] Selfie face check failed — failing open for manual review:', err);
    return { hasFace: true, faceCount: 0, response: { error: String(err) } };
  }

  clearTimeout(timer);

  // If Sightengine returns an error (e.g. model not on plan) — fail open for manual review
  if (raw['status'] === 'failure' || raw['error']) {
    console.warn('[moderation] Sightengine face model error — failing open:', raw);
    return { hasFace: true, faceCount: 0, response: raw };
  }

  const faces = raw['faces'] as Array<{ confidence: number }> | undefined;

  if (!faces || faces.length === 0) {
    return {
      hasFace:  false,
      faceCount: 0,
      reason:   'No face detected — remove your helmet or sunglasses and make sure your face is clearly visible in the photo',
      response: raw,
    };
  }

  // Use a low threshold — just verify a face is detectable at all
  const visibleFaces = faces.filter(f => f.confidence >= 0.2);

  if (visibleFaces.length === 0) {
    return {
      hasFace:  false,
      faceCount: faces.length,
      reason:   'Face not clearly visible — use good lighting, face the camera directly, and remove any helmet or face covering',
      response: raw,
    };
  }

  return { hasFace: true, faceCount: visibleFaces.length, response: raw };
}
