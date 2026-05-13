const BYPASS_IN_DEV = true;

export function isDevBypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && BYPASS_IN_DEV;
}
