import { useState } from 'react'
import { Modal, Button, Alert, initialsOf } from '../../design-system'
import { transferOwnership, type LeagueMember } from '../../services/supabase/leagues'
import s from './detail.module.css'

export type TransferOwnershipModalProps = {
  open: boolean
  onClose: () => void
  leagueId: string
  // Members eligible to become owner (everyone except the current owner).
  candidates: LeagueMember[]
  onTransferred: () => void
}

/**
 * Owner-only: hand the league to another member. A member picker (radio list) →
 * confirm. Leagues are never orphaned, so this (or delete) is how an owner
 * leaves (design-system §6). The server re-checks ownership.
 */
export function TransferOwnershipModal({
  open,
  onClose,
  leagueId,
  candidates,
  onTransferred,
}: TransferOwnershipModalProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function close() {
    setSelected(null)
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
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Could not transfer ownership.')
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
          <Button onClick={confirm} loading={busy} disabled={!selected}>
            Transfer
          </Button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p>There's no one else in the league to transfer to yet.</p>
      ) : (
        <>
          <p style={{ margin: '0 0 4px' }}>Choose who takes over the league.</p>
          <div className={s.transferList} role="radiogroup" aria-label="New owner">
            {candidates.map((m) => (
              <button
                key={m.userId}
                type="button"
                role="radio"
                aria-checked={selected === m.userId}
                className={`${s.transferItem} ${selected === m.userId ? s.transferItemActive : ''}`}
                onClick={() => setSelected(m.userId)}
              >
                <span className={s.transferAvatar} aria-hidden="true">
                  {initialsOf(m.displayName)}
                </span>
                <span className={s.transferName}>{m.displayName}</span>
              </button>
            ))}
          </div>
          {error && (
            <Alert variant="error" title="Couldn't transfer">
              {error}
            </Alert>
          )}
        </>
      )}
    </Modal>
  )
}
