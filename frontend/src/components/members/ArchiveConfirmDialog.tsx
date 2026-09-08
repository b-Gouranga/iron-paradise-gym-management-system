import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { archiveMember } from '../../services/membersService'

interface ArchiveConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  memberId: string
  memberName: string
  memberCode: string
}

export function ArchiveConfirmDialog({
  isOpen,
  onClose,
  onSuccess,
  memberId,
  memberName,
  memberCode,
}: ArchiveConfirmDialogProps) {
  const { session } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleArchive() {
    const token = session?.access_token
    if (!token) {
      setError('You must be logged in to perform this action.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await archiveMember(token, memberId)
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive member.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#1C1C1F] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[.07] pb-4">
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle size={20} />
            <h2 id="archive-dialog-title" className="text-base font-bold text-white">
              Archive Member
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[.06] hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-950/40 p-3 text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}

        <div className="mt-4 space-y-2 text-sm text-zinc-300">
          <p>
            Are you sure you want to archive{' '}
            <strong className="text-white">{memberName}</strong> (
            <span className="font-mono text-zinc-300">{memberCode}</span>)?
          </p>
          <p className="text-xs text-zinc-500">
            This will set their status to <strong className="text-zinc-400">Inactive</strong>.
            All historical memberships, payment records, and audit history are safely preserved and will not be deleted.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-white/[.07] pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-white/[.06] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleArchive}
            disabled={loading}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            {loading ? 'Archiving...' : 'Archive Member'}
          </button>
        </div>
      </div>
    </div>
  )
}
