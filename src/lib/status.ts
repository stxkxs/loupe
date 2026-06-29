import type { ApprovalStatus, ShortageStatus } from '@/core/schema'

// Domain status → house semantic token (SPEC §color_direction). Mapping lives in ONE
// place and drives every chip + dot; we never invent new hexes per status.
export type Semantic = 'success' | 'warning' | 'danger' | 'primary' | 'dim'

export const APPROVAL_SEM: Record<ApprovalStatus, Semantic> = {
  approved: 'success',
  'black-box': 'danger',
  'off-label': 'warning',
  withdrawn: 'danger',
  investigational: 'primary',
}

export const SHORTAGE_SEM: Record<ShortageStatus, Semantic> = {
  available: 'success',
  limited: 'warning',
  'in-shortage': 'danger',
  discontinued: 'dim',
  resolved: 'success',
}

export const SHORTAGE_LABEL: Record<ShortageStatus, string> = {
  available: 'Available',
  limited: 'Limited supply',
  'in-shortage': 'In shortage',
  discontinued: 'Discontinued',
  resolved: 'Resolved',
}
