import { Bell, Dumbbell, LogOut, Menu, Search, X } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Input } from '../components/Input'
import { useAuth } from '../hooks/useAuth'

const navigation = [
  ['Dashboard', '/dashboard'],
  ['Members', '/members'],
  ['Membership Plans', '/membership-plans'],
  ['Payments', '/payments'],
  ['Renewals', '/renewals'],
  ['Reminders', '/reminders'],
  ['Reports', '/reports'],
  ['Trainers', '/trainers'],
  ['Settings', '/settings'],
] as const

function Sidebar({ close }: { close?: () => void }) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-white/[.07] bg-[#151517] px-4 py-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand p-2 text-white">
            <Dumbbell size={21} />
          </div>
          <div>
            <p className="font-['Oswald'] text-xl font-semibold tracking-wide text-white">
              IRON PARADISE
            </p>
            <p className="text-[10px] uppercase tracking-[.18em] text-zinc-500">
              Gym Management
            </p>
          </div>
        </div>
        {close && (
          <button onClick={close} className="text-zinc-400 md:hidden">
            <X />
          </button>
        )}
      </div>

      <nav className="mt-10 space-y-1">
        {navigation.map(([name, href]) => (
          <NavLink
            key={href}
            to={href}
            onClick={close}
            className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
          >
            {name}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-xl border border-white/[.07] bg-white/[.025] p-3">
        <p className="text-xs font-semibold text-zinc-300">Iron Paradise v0.6</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Membership Plans · Part 6</p>
      </div>
    </aside>
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, logout } = useAuth()

  const title =
    navigation.find(([, path]) => path === location.pathname)?.[0] ?? 'Dashboard'

  // Derive display initials from the real profile name
  const displayName = profile?.full_name ?? '—'
  const displayRole = profile?.role === 'owner' ? 'Owner' : profile?.role === 'trainer' ? 'Trainer' : '—'
  const initials = displayName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#111113]">
      {/* Desktop sidebar */}
      <div className="fixed inset-y-0 left-0 z-30 hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/70"
          />
          <div className="relative h-full">
            <Sidebar close={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="md:ml-72">
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-white/[.07] bg-[#111113]/90 px-4 backdrop-blur md:px-8">
          <button
            className="text-zinc-300 md:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[.15em] text-zinc-500">
              Operations
            </p>
            <p className="truncate text-base font-semibold text-white">{title}</p>
          </div>

          <div className="hidden w-64 lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
              <Input
                aria-label="Search"
                placeholder="Search members…"
                className="py-2 pl-9"
              />
            </div>
          </div>

          <button
            aria-label="Notifications"
            className="relative rounded-lg p-2 text-zinc-400 hover:bg-white/[.06] hover:text-white"
          >
            <Bell size={20} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />
          </button>

          {/* User avatar + name + logout */}
          <div className="flex items-center gap-2 border-l border-white/[.07] pl-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-700 text-sm font-bold text-white">
              {initials || '?'}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-white">{displayName}</p>
              <p className="text-xs capitalize text-zinc-500">{displayRole}</p>
            </div>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="ml-1 rounded-lg p-2 text-zinc-400 transition hover:bg-white/[.06] hover:text-white"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="mx-auto max-w-[1600px] p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
