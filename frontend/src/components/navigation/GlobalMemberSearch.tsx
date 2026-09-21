import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronRight, Loader2, Search, X } from 'lucide-react'
import { fetchMembers } from '../../services/membersService'
import { useAuth } from '../../hooks/useAuth'
import type { MemberListItem } from '../../types/members'

interface GlobalMemberSearchProps {
  className?: string
  onSelect?: () => void
}

export function GlobalMemberSearch({ className = '', onSelect }: GlobalMemberSearchProps) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<MemberListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)

  // Debounce input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  // Fetch search results when debounced query changes
  useEffect(() => {
    if (!debouncedQuery) {
      setResults([])
      setLoading(false)
      setError(null)
      setSelectedIndex(-1)
      return
    }

    const token = session?.access_token
    if (!token) return

    let isCancelled = false
    setLoading(true)
    setError(null)

    fetchMembers(token, { q: debouncedQuery, limit: 8 })
      .then((data) => {
        if (!isCancelled) {
          setResults(data.members || [])
          setSelectedIndex(-1)
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Search failed')
          setResults([])
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [debouncedQuery, session?.access_token])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelectMember(memberId: string) {
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(-1)
    if (onSelect) onSelect()
    navigate(`/members/${memberId}`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectMember(results[selectedIndex].id)
      } else if (results.length === 1) {
        handleSelectMember(results[0].id)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  function handleClear() {
    setQuery('')
    setResults([])
    setSelectedIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-3 text-zinc-500"
          size={16}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="global-member-search-results"
          aria-label="Search members by name, phone, email, or ID"
          placeholder="Search members (name, phone, ID)…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!isOpen) setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-white/10 bg-white/[.04] py-2 pl-9 pr-9 text-sm text-white placeholder-zinc-500 transition-colors focus:border-brand/70 focus:bg-white/[.07] focus:outline-none focus:ring-1 focus:ring-brand/40"
        />
        {loading ? (
          <Loader2
            className="absolute right-3 animate-spin text-zinc-400"
            size={16}
            aria-hidden="true"
          />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div
          id="global-member-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-white/10 bg-[#161619] p-2 shadow-2xl backdrop-blur-xl ring-1 ring-black/50 sm:min-w-[360px]"
        >
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-zinc-400">
              <Loader2 size={15} className="animate-spin text-brand" />
              <span>Searching members…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 px-3 py-4 text-xs text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && !debouncedQuery && (
            <div className="px-3 py-4 text-center text-xs text-zinc-500">
              Type a name, 10-digit phone, email, or member code (e.g. IP-00001)
            </div>
          )}

          {!loading && !error && debouncedQuery && results.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-zinc-400">
              No members found matching &ldquo;<span className="text-white font-medium">{debouncedQuery}</span>&rdquo;
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Members ({results.length})
              </div>
              {results.map((m, index) => {
                const isSelected = index === selectedIndex
                return (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => handleSelectMember(m.id)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                      isSelected ? 'bg-white/[.09] text-white' : 'hover:bg-white/[.05] text-zinc-300'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-white">{m.full_name}</p>
                        <span className="shrink-0 rounded bg-white/[.08] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                          {m.member_code}
                        </span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${
                            m.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-400">
                        <span>{m.phone}</span>
                        {m.email && <span className="truncate text-zinc-500">{m.email}</span>}
                        {m.current_membership?.plan_name && (
                          <span className="truncate text-brand/90 font-medium">
                            {m.current_membership.plan_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-zinc-500" />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
