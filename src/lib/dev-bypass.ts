import { isProductionRuntime } from '@/lib/runtime-env';

export function isDevBypassEnabled(): boolean {
  if (isProductionRuntime()) return false;
  return process.env.DEV_BYPASS_AUTH === 'true';
}
