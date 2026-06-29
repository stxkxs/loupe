import { z } from 'zod'

// REST query validation — the same Zod discipline the MCP boundary uses, so a bad
// `limit`/`sort` fails fast with 400 instead of silently coercing to NaN/[].
export const listQuery = z.object({
  class: z.string().optional(),
  status: z.string().optional(),
  shortage: z.string().optional(),
  sort: z.enum(['cost', 'name']).optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
})

export const searchQuery = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().positive().max(100).optional(),
})
