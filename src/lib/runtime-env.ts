export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}
