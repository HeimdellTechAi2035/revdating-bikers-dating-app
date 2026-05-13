import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

const FAKE_USER_ID = 'dev-user-00000000-0000-0000-0000-000000000000';

const fakeUser = {
  id: FAKE_USER_ID,
  email: 'dev@REVdating.local',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  role: '',
  phone: '',
};

const fakeProfile = {
  id: FAKE_USER_ID,
  email: 'dev@REVdating.local',
  display_name: 'Dev Admin',
  full_name: 'Dev Admin',
  date_of_birth: '1990-01-01',
  gender: 'man',
  bio: 'Dev bypass active',
  riding_style: 'cruiser',
  dating_intent: 'open_to_anything',
  max_distance_miles: 50,
  onboarding_complete: true,
  is_banned: false,
  is_active: true,
  is_premium: true,
  is_verified: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fakeAdminUser = {
  id: FAKE_USER_ID,
  role: 'super_admin',
};

class StubQueryBuilder {
  private _table: string;
  private _isSingle = false;
  private _isMaybeSingle = false;

  constructor(table: string) {
    this._table = table;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  select(..._args: unknown[]): this { return this; }
  eq(..._args: unknown[]): this { return this; }
  neq(..._args: unknown[]): this { return this; }
  gt(..._args: unknown[]): this { return this; }
  lt(..._args: unknown[]): this { return this; }
  gte(..._args: unknown[]): this { return this; }
  lte(..._args: unknown[]): this { return this; }
  like(..._args: unknown[]): this { return this; }
  ilike(..._args: unknown[]): this { return this; }
  is(..._args: unknown[]): this { return this; }
  in(..._args: unknown[]): this { return this; }
  contains(..._args: unknown[]): this { return this; }
  containedBy(..._args: unknown[]): this { return this; }
  overlaps(..._args: unknown[]): this { return this; }
  match(..._args: unknown[]): this { return this; }
  not(..._args: unknown[]): this { return this; }
  or(..._args: unknown[]): this { return this; }
  filter(..._args: unknown[]): this { return this; }
  order(..._args: unknown[]): this { return this; }
  limit(..._args: unknown[]): this { return this; }
  range(..._args: unknown[]): this { return this; }
  insert(..._args: unknown[]): this { return this; }
  upsert(..._args: unknown[]): this { return this; }
  update(..._args: unknown[]): this { return this; }
  delete(..._args: unknown[]): this { return this; }
  abortSignal(..._args: unknown[]): this { return this; }
  returns(..._args: unknown[]): this { return this; }
  throwOnError(): this { return this; }
  overrideTypes(..._args: unknown[]): this { return this; }

  single(): this {
    this._isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this._isMaybeSingle = true;
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this._resolve()).then(onfulfilled, onrejected);
  }

  private _resolve(): { data: unknown; error: null; count?: number } {
    if (this._isSingle || this._isMaybeSingle) {
      if (this._table === 'profiles') return { data: fakeProfile, error: null };
      if (this._table === 'admin_users') return { data: fakeAdminUser, error: null };
      return { data: null, error: null };
    }
    return { data: [], error: null, count: 0 };
  }
}

const stubChannel = (() => {
  const ch = {
    on: (..._args: unknown[]) => ch,
    subscribe: (..._args: unknown[]) => ch,
    unsubscribe: async () => 'ok' as const,
    send: async (_msg: unknown) => ({ status: 'ok' as const }),
    track: async (_state: unknown) => ({ status: 'ok' as const }),
    untrack: async () => ({ status: 'ok' as const }),
  };
  return ch;
})();

export function createStubClient(): SupabaseClient<Database> {
  const stub = {
    auth: {
      getUser: async () => ({ data: { user: fakeUser }, error: null }),
      getSession: async () => ({
        data: {
          session: {
            user: fakeUser,
            access_token: 'stub-token',
            refresh_token: 'stub-refresh',
            expires_in: 3600,
            token_type: 'bearer',
          },
        },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: (_callback: unknown) => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signInWithPassword: async () => ({
        data: { user: fakeUser, session: null },
        error: null,
      }),
      signUp: async () => ({ data: { user: fakeUser, session: null }, error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: null }),
      updateUser: async () => ({ data: { user: fakeUser }, error: null }),
    },
    from: (table: string) => new StubQueryBuilder(table),
    rpc: (_fn: string, _args?: unknown) => new StubQueryBuilder('__rpc__'),
    storage: {
      from: (_bucket: string) => ({
        upload: async () => ({ data: null, error: null }),
        download: async () => ({ data: null, error: null }),
        remove: async () => ({ data: [], error: null }),
        list: async () => ({ data: [], error: null }),
        getPublicUrl: (_path: string) => ({ data: { publicUrl: '' } }),
        createSignedUrl: async () => ({ data: null, error: null }),
      }),
    },
    channel: (_name: string) => stubChannel,
    removeChannel: async (_channel: unknown) => ({ data: 'ok', error: null }),
    removeAllChannels: async () => ({ data: [], error: null }),
    getChannels: () => [],
    realtime: { setAuth: (_token: string | null) => {} },
  };

  return stub as unknown as SupabaseClient<Database>;
}
