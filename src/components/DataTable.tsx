import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  label: string
  align?: 'left' | 'right'
  render?: (row: T) => ReactNode
}

// DataTable conventions: mono, sticky header, tabular-nums, hover rows.
// Generic over the row type so callers pass typed rows (no `as unknown as` at the seam).
export function DataTable<T extends object>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse font-mono text-[11.5px]">
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  'border-b border-border px-2.5 py-1.5 text-left font-medium text-dim',
                  c.align === 'right' && 'text-right',
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-hover">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'border-b border-border/50 px-2.5 py-1.5 text-muted tabular-nums',
                    c.align === 'right' && 'text-right',
                  )}
                >
                  {c.render ? c.render(row) : ((row as Record<string, unknown>)[c.key] as ReactNode) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
