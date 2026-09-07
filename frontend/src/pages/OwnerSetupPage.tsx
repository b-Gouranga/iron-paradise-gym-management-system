import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'

type SetupState = 'idle' | 'submitting' | 'success' | 'error'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

export function OwnerSetupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [state, setState] = useState<SetupState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isLoading = state === 'submitting'

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)

    if (!fullName.trim()) {
      setErrorMsg('Full name is required.')
      return
    }
    if (!email.trim()) {
      setErrorMsg('Email address is required.')
      return
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      return
    }

    setState('submitting')

    try {
      const res = await fetch(`${API_BASE}/api/auth/setup-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const msg: string =
          res.status === 409
            ? 'An owner account already exists. Only one owner can be set up.'
            : (json as { message?: string }).message ?? 'Setup failed. Please try again.'
        setState('error')
        setErrorMsg(msg)
        return
      }

      setState('success')
    } catch {
      setState('error')
      setErrorMsg('Could not reach the server. Please check your connection and try again.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111113] p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-10 flex items-center gap-3">
          <div className="rounded-xl bg-brand p-2.5 text-white">
            <Dumbbell size={24} />
          </div>
          <span className="font-['Oswald'] text-xl font-semibold tracking-wide text-white">
            IRON PARADISE
          </span>
        </div>

        {state === 'success' ? (
          /* ── Success state ─────────────────────────────────── */
          <div className="rounded-2xl border border-emerald-800/40 bg-emerald-950/30 p-8 text-center">
            <div className="mb-4 flex justify-center text-emerald-400">
              <CheckCircle2 size={44} />
            </div>
            <h1 className="text-2xl font-bold text-white">Owner account created!</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Your Iron Paradise owner account is ready. You can now sign in to
              access the management dashboard.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-block rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
            >
              Go to login
            </Link>
          </div>
        ) : (
          /* ── Setup form ────────────────────────────────────── */
          <>
            <p className="text-sm font-semibold uppercase tracking-[.16em] text-brand">
              Initial setup
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
              Create owner account
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              This page creates the first and only owner account for Iron
              Paradise. Once an owner exists, this page will reject further
              requests.
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
              {errorMsg && (
                <div className="flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{errorMsg}</p>
                </div>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">
                  Full name <span className="text-brand">*</span>
                </span>
                <Input
                  type="text"
                  placeholder="Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  autoComplete="name"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">
                  Email address <span className="text-brand">*</span>
                </span>
                <Input
                  type="email"
                  placeholder="owner@ironparadise.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">
                  Password <span className="text-brand">*</span>
                </span>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Minimum 8 characters"
                    className="pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-2.5 text-zinc-500 transition hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-brand/60 rounded"
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">
                  Phone{' '}
                  <span className="text-xs text-zinc-500">(optional)</span>
                </span>
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading}
                  autoComplete="tel"
                />
              </label>

              <Button type="submit" className="w-full py-3" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  'Create owner account'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs text-zinc-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-zinc-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  )
}
