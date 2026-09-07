import { type FormEvent, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Dumbbell, Eye, EyeOff, LockKeyhole, Mail, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // If the user is already authenticated, redirect them to the dashboard
  // (or wherever they originally tried to go).
  const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/dashboard'
  if (!authLoading && isAuthenticated) {
    navigate(from, { replace: true })
    return null
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.')
      return
    }
    if (!password) {
      setErrorMsg('Please enter your password.')
      return
    }

    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const isLoading = submitting || authLoading

  return (
    <main className="grid min-h-screen bg-[#111113] lg:grid-cols-2">
      {/* ── Left hero panel ───────────────────────────────────────── */}
      <section className="relative hidden overflow-hidden bg-brand p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_80%,rgba(0,0,0,.35),transparent_40%)]" />

        <div className="relative flex items-center gap-3">
          <div className="rounded-xl bg-white p-2.5 text-brand">
            <Dumbbell size={25} />
          </div>
          <span className="font-['Oswald'] text-2xl font-bold tracking-wide text-white">
            IRON PARADISE
          </span>
        </div>

        <div className="relative max-w-lg">
          <p className="font-['Oswald'] text-6xl font-semibold uppercase leading-[.95] tracking-wide text-white">
            Built for
            <br />
            stronger
            <br />
            operations.
          </p>
          <p className="mt-7 max-w-sm text-lg leading-7 text-white/75">
            The focused command center for an exceptional member experience.
          </p>
        </div>

        <p className="relative text-sm text-white/60">© 2026 Iron Paradise Gym</p>
      </section>

      {/* ── Right login panel ─────────────────────────────────────── */}
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <div className="rounded-xl bg-brand p-2 text-white">
              <Dumbbell />
            </div>
            <span className="font-['Oswald'] text-xl font-semibold tracking-wide text-white">
              IRON PARADISE
            </span>
          </div>

          <p className="text-sm font-semibold uppercase tracking-[.16em] text-brand">
            Welcome back
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
            Sign in to your gym
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Enter your credentials to access the Iron Paradise management dashboard.
          </p>

          <form className="mt-9 space-y-5" onSubmit={handleSubmit} noValidate>
            {/* Error banner */}
            {errorMsg && (
              <div className="flex items-start gap-3 rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{errorMsg}</p>
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">
                Email address
              </span>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 text-zinc-500" size={17} />
                <Input
                  type="email"
                  placeholder="you@ironparadise.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">
                Password
              </span>
              <div className="relative">
                <LockKeyhole className="absolute left-3.5 top-3 text-zinc-500" size={17} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
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

            <Button type="submit" className="w-full py-3" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Signing in…
                </span>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-zinc-600">
            First time setup?{' '}
            <a
              href="/setup"
              className="font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Create owner account
            </a>
          </p>
        </div>
      </section>
    </main>
  )
}
