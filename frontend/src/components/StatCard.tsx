import { ArrowUpRight } from 'lucide-react'
import { Card } from './Card'

export function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: string
}) {
  const color =
    tone === 'green'
      ? 'text-emerald-400'
      : tone === 'amber'
        ? 'text-amber-400'
        : 'text-brand'

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs sm:text-sm font-medium text-zinc-400">{label}</p>
        <ArrowUpRight size={17} className={`${color} shrink-0`} />
      </div>
      <p className="mt-3 sm:mt-4 text-xl sm:text-2xl font-bold tracking-tight text-white truncate">
        {value}
      </p>
      <p className={`mt-1.5 sm:mt-2 text-xs font-medium ${color}`}>{detail}</p>
    </Card>
  )
}
