import { Dumbbell, LogOut, Menu, Search, X } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { GlobalMemberSearch } from '../components/navigation/GlobalMemberSearch'
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
        <p className="text-xs font-semibold text-zinc-300">Iron Paradise v1.0</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">System Integration · Part 14</p>
      </div>
    </aside>
  )
}

export function AppLayout() {
  const [open, setOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
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
        <header className="sticky top-0 z-20 flex h-16 sm:h-20 items-center gap-3 sm:gap-4 border-b border-white/[.07] bg-[#111113]/90 px-3.5 sm:px-6 backdrop-blur md:px-8">
          {mobileSearchOpen ? (
            <div className="flex w-full items-center gap-2">
              <GlobalMemberSearch
                className="flex-1"
                onSelect={() => setMobileSearchOpen(false)}
              />
              <button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white sm:hidden"
                aria-label="Close search"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <>
              <button
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-300 hover:bg-white/5 md:hidden"
                aria-label="Open navigation"
                onClick={() => setOpen(true)}
              >
                <Menu size={22} />
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-[.15em] text-zinc-500">
                  Operations
                </p>
                <p className="truncate text-base font-semibold text-white">{title}</p>
              </div>

              {/* Desktop/Tablet search */}
              <div className="hidden sm:block sm:w-64 md:w-72 lg:w-80">
                <GlobalMemberSearch />
              </div>

              {/* Mobile search trigger */}
              <button
                type="button"
                onClick={() => setMobileSearchOpen(true)}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-400 hover:bg-white/[.06] hover:text-white sm:hidden"
                aria-label="Search members"
              >
                <Search size={20} />
              </button>

              {/* User avatar + name + logout */}
              <div className="flex items-center gap-2 border-l border-white/[.07] pl-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-700 text-sm font-bold text-white">
                  {initials || '?'}
                </div>
                <div className="hidden md:block">
                  <p className="text-sm font-semibold text-white">{displayName}</p>
                  <p className="text-xs capitalize text-zinc-500">{displayRole}</p>
                </div>
                <button
                  onClick={handleLogout}
                  aria-label="Log out"
                  title="Log out"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[.06] hover:text-white"
                >
                  <LogOut size={17} />
                </button>
              </div>
            </>
          )}
        </header>

        <div className="mx-auto max-w-[1600px] p-3.5 sm:p-6 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
