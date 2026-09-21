import type { ReactNode } from 'react'

interface DataTableProps {
  headers: string[]
  children: ReactNode
  minWidth?: string
}

export function DataTable({
  headers,
  children,
  minWidth = 'min-w-[600px]',
}: DataTableProps) {
  return (
    <div className="overflow-x-auto w-full">
      <table className={`min-w-full ${minWidth}`}>
        <thead>
          <tr className="border-b border-white/[.07]">
            {headers.map(h => (
              <th key={h} className="table-head">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[.06]">{children}</tbody>
      </table>
    </div>
  )
}
