import { userFacingError } from '../../shared/errors/userFacingError'
import { useEffect, useState } from 'react'
import { Modal, Button, Alert, Skeleton, TextInput, initialsOf } from '../../design-system'
import {
  searchLeagueTransferCandidates,
  transferOwnership,
  type TransferCandidate,
} from '../../services/supabase/leagues'
import s from './detail.module.css'

export type TransferOwnershipModalProps = {
  open: boolean
  onClose: () => void
  leagueId: string
  onTransferred: () => void
}

/**
 * Owner-only: search the separate server-owned candidate directory, choose one
 * member, then call the existing authoritative transfer mutation. The standings
 * page no longer needs to download every member just to populate this modal.
 */
export function TransferOwnershipModal({
  open,
  onClose,
  leagueId,
  onTransferred,
}: TransferOwnershipModalProps) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<TransferCandidate[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)
    setLoadError(null)

    const timer = window.setTimeout(() => {
      searchLeagueTransferCandidates(leagueId, query, 20)
        .then((rows) => {
          if (!active) return
          setCandidates(rows)
          setSelected((current) =>
            current && rows.some((candidate) => candidate.userId === current) ? current : null,
          )
        })
        .catch((loadFailure) => {
          if (!active) return
          setCandidates([])
          setSelected(null)
          setLoadError(
            userFacingError(loadFailure, 'Could not load league members. Please try again.'),
          )
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    }, 220)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [open, leagueId, query, reloadKey])

  function close() {
    setQuery('')
    setCandidates([])
    setSelected(null)
    setLoading(false)
    setLoadError(null)
    setReloadKey(0)
    setBusy(false)
    setError(null)
    onClose()
  }

  async function confirm() {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await transferOwnership(leagueId, selected)
      close()
      onTransferred()
    } catch (transferError) {
      setBusy(false)
      setError(userFacingError(transferError, 'Could not transfer ownership. Please try again.'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Transfer ownership"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={confirm} loading={busy} disabled={!selected || loading}>
            Transfer
          </Button>
        </>
      }
    >
      <p className={s.transferIntro}>Choose who takes over the league.</p>
      <div className={s.transferSearch}>
        <TextInput
          label="Search members"
          value={query}
          placeholder="Type a player name"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {loading ? (
        <div className={s.transferState}>
          <Skeleton lines={3} />
        </div>
      ) : loadError ? (
        <Alert variant="error" title="Couldn't load members">
          {loadError}
          <div className={s.transferRetry}>
            <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : candidates.length === 0 ? (
        <p className={s.transferState}>
          {query.trim()
            ? 'No league members match that search.'
            : "There's no one else in the league to transfer to yet."}
        </p>
      ) : (
        <div className={s.transferList} role="radiogroup" aria-label="New owner">
          {candidates.map((candidate) => (
            <button
              key={candidate.userId}
              type="button"
              role="radio"
              aria-checked={selected === candidate.userId}
              className={`${s.transferItem} ${
                selected === candidate.userId ? s.transferItemActive : ''
              }`}
              onClick={() => setSelected(candidate.userId)}
            >
              <span className={s.transferAvatar} aria-hidden="true">
                {initialsOf(candidate.displayName)}
              </span>
              <span className={s.transferName}>{candidate.displayName}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <Alert variant="error" title="Couldn't transfer">
          {error}
        </Alert>
      )}
    </Modal>
  )
}
