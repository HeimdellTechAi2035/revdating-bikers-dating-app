import 'server-only';

import { isNextProductionBuild, isProductionRuntime } from '@/lib/runtime-env';

export { isNextProductionBuild, isProductionRuntime };

const REQUIRED_PRODUCTION_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type RequiredProductionEnv = (typeof REQUIRED_PRODUCTION_ENV)[number];

function shouldValidateProductionEnv(): boolean {
  return isProductionRuntime() && !isNextProductionBuild();
}

export function validateProductionEnv(
  required: readonly RequiredProductionEnv[] = REQUIRED_PRODUCTION_ENV,
): void {
  if (!shouldValidateProductionEnv()) return;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length === 0) return;

  throw new Error(
    [
      'Missing required production environment variable(s):',
      missing.join(', '),
      'Set these in your deployment provider before starting the app.',
    ].join(' '),
  );
}

export function getRequiredProductionEnv(name: RequiredProductionEnv): string | undefined {
  const value = process.env[name];
  if (!value && shouldValidateProductionEnv()) {
    throw new Error(
      `Missing required production environment variable: ${name}. Set it in your deployment provider before starting the app.`,
    );
  }
  return value;
}
