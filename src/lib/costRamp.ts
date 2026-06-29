// The cost ramp — the brand gradient extended to coral, NOT a theme token. Cheap reads
// as the calm cool (blue/periwinkle) end of the brand; expensive warms through lilac/peach to
// a coral "high" — bill-anxiety reframed without softening the fact. Legend swatch + cell heat.
export const COST_RAMP = ['#9db4f2', '#b7b6ee', '#d8c4ec', '#f2cdc9', '#eaa886', '#e2745a', '#d24b3e']

export function costColor(value: number, min: number, max: number): string {
  if (!Number.isFinite(value) || max <= min) return COST_RAMP[3]
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return COST_RAMP[Math.round(t * (COST_RAMP.length - 1))]
}
