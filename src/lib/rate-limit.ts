// Sliding-window rate limiter backed by an in-memory Map.
// Sufficient for single-instance deployments; swap the store for
// Upstash Redis if you need exact global enforcement across edge nodes.

interface Record {
  count: number;
  resetAt: number;
}

const store = new Map<string, Record>();
let lastPrune = Date.now();

function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 5 * 60_000) return;
  lastPrune = now;
  Array.from(store.entries()).forEach(([k, v]) => {
    if (now > v.resetAt) store.delete(k);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  maybePrune();
  const now = Date.now();
  const rec = store.get(key);

  if (!rec || now > rec.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (rec.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: rec.resetAt };
  }

  rec.count += 1;
  return { allowed: true, remaining: maxRequests - rec.count, resetAt: rec.resetAt };
}

export function tooManyRequestsResponse(resetAt: number): Response {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    },
  );
}
