import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="mb-5 sm:mb-6 flex flex-wrap items-end justify-between gap-3 sm:gap-4">
      <div>
        <h1 className="font-['Oswald'] text-2xl sm:text-3xl font-semibold uppercase tracking-wide text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}
