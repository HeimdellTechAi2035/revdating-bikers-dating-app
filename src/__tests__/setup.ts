/**
 * src/__tests__/setup.ts
 *
 * Global Vitest setup. Mocks all external dependencies so lib functions
 * can be tested in isolation (no real DB, no real Stripe, no network).
 *
 * The mock Supabase client exposes a fluent chain builder whose resolved
 * value can be configured per-test via `setMockQueryResult()`.
 */
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase admin client mock
// ---------------------------------------------------------------------------

/**
 * Queue of results to be returned by sequential Supabase queries.
 * Each call to .single() / .maybeSingle() / the final awaitable pops the
 * first entry off this array.
 *
 * Usage in tests:
 *   queueMockResults([
 *     { data: { id: 'abc', is_admin: true }, error: null },   // 1st query
 *     { data: null, error: null },                             // 2nd query
 *   ]);
 */
const _queue: Array<{ data: unknown; error: unknown }> = [];

export function queueMockResults(
  results: Array<{ data: unknown; error: unknown }>,
) {
  _queue.push(...results);
}

export function clearMockQueue() {
  _queue.length = 0;
}

function dequeue(): { data: unknown; error: unknown } {
  if (_queue.length === 0) {
    // Default: empty success
    return { data: null, error: null };
  }
  return _queue.shift()!;
}

/** Creates a fluent Supabase-like query chain that resolves via the queue. */
function makeChain(): Record<string, unknown> {
  const terminalResult = async () => dequeue();

  const chain: Record<string, unknown> = {};
  const chainMethods = [
    'from', 'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'in', 'is', 'gt', 'lt', 'gte', 'lte',
    'or', 'not', 'order', 'limit', 'filter',
  ];

  for (const method of chainMethods) {
    chain[method] = vi.fn(() => chain);
  }

  // Terminal methods — pop from the queue and resolve
  chain['single']      = vi.fn(terminalResult);
  chain['maybeSingle'] = vi.fn(terminalResult);

  // Make the chain itself a thenable (handles `await admin.from(…).select(…)`)
  (chain as unknown as PromiseLike<unknown>).then = (resolve: (v: unknown) => void) => {
    resolve(dequeue());
    return Promise.resolve();
  };

  return chain;
}

/** Shared mock admin Supabase client used across all tests. */
export const mockAdminClient = {
  from: vi.fn(() => makeChain()),
  storage: {
    from: vi.fn(() => ({
      remove: vi.fn(async () => ({ error: null })),
      upload: vi.fn(async () => ({ data: { path: 'mock/path' }, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://mock.storage/photo.jpg' } })),
    })),
  },
  auth: {
    admin: {
      deleteUser: vi.fn(async () => ({ error: null })),
      getUserById: vi.fn(async () => ({ data: { user: { id: 'mock-id', email: 'test@test.com' } }, error: null })),
    },
    getUser: vi.fn(async () => ({
      data: { user: { id: 'mock-admin-id', email: 'admin@test.com' } },
      error: null,
    })),
  },
} as unknown as ReturnType<import('@/lib/supabase/admin').createAdminClient>;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

// ---------------------------------------------------------------------------
// Supabase server client mock (used by requireAdmin → createClient())
// ---------------------------------------------------------------------------
export const mockServerClient = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: 'mock-admin-id', email: 'admin@test.com' } },
      error: null,
    })),
  },
} as unknown as Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockServerClient),
}));

// ---------------------------------------------------------------------------
// Stripe mock
// ---------------------------------------------------------------------------
vi.mock('stripe', () => {
  const Stripe = vi.fn(() => ({
    subscriptions: {
      cancel:   vi.fn(async () => ({ id: 'sub_mock', status: 'canceled' })),
      retrieve: vi.fn(async () => ({ id: 'sub_mock', status: 'active' })),
    },
    customers: {
      create: vi.fn(async () => ({ id: 'cus_mock' })),
    },
  }));
  return { default: Stripe };
});

// ---------------------------------------------------------------------------
// Notifications mock (fire-and-forget — never want real pushes in tests)
// ---------------------------------------------------------------------------
vi.mock('@/lib/notifications', () => ({
  notifyNewMessage: vi.fn(async () => undefined),
}));

// ---------------------------------------------------------------------------
// Badges mock (award logic tested separately; avoid side effects here)
// ---------------------------------------------------------------------------
vi.mock('@/lib/badges', () => ({
  awardBadge:                      vi.fn(async () => undefined),
  checkAndAwardFirstMatch:         vi.fn(async () => undefined),
  checkAndAwardMatchBadges:        vi.fn(async () => undefined),
  checkAndAwardRevvedUp:           vi.fn(async () => undefined),
  checkAndAwardMessageBadge:       vi.fn(async () => undefined),
  checkAndAwardRideDateBadge:      vi.fn(async () => undefined),
  checkAndAwardVerificationBadges: vi.fn(async () => undefined),
  getUserBadges:                   vi.fn(async () => []),
}));

// ---------------------------------------------------------------------------
// afterEach: reset all mock state between tests
// ---------------------------------------------------------------------------
afterEach(() => {
  vi.clearAllMocks();
  clearMockQueue();
});
