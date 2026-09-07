import type { InputHTMLAttributes } from 'react'
export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) { return <input className={`w-full rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-brand/70 ${className}`} {...props} /> }
