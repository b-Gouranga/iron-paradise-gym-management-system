import type { ButtonHTMLAttributes } from 'react'
export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button className={`rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-brand/60 ${className}`} {...props} /> }
