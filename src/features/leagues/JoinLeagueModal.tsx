import { useState } from 'react'
import { Modal, TextInput, Button, Alert } from '../../design-system'
import { fetchLeaguePreview, joinLeague, type LeaguePreview } from '../../services/supabase/leagues'
import { LeaguePreviewCard } from './LeaguePreviewCard'
import s from './leagueForms.module.css'

export type JoinLeagueModalProps = {
  open: boolean
  onClose: () => void
  onJoined: (leagueId: string) => void
}

/**
 * Code-entry join sheet — the fallback path when someone has a code but not the
 * link (design-system §6, invite links are primary). Enter code → preview →
 * Join. The rich link flow lives on the /join/:code deep-link page; both share
 * LeaguePreviewCard.
 */
export function JoinLeagueModal({ open, onClose, onJoined }: JoinLeagueModalProps) {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<LeaguePreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setCode('')
    setPreview(null)
    setBusy(false)
    setError(null)
  }

  function close() {
    reset()
    onClose()
  }

  async function lookUp() {
    const c = code.trim().toUpperCase()
    if (c.length < 1) {
      setError('Enter an invite code.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const p = await fetchLeaguePreview(c)
      if (!p) {
        setError("That code doesn't match a league. Check it and try again.")
      } else {
        setPreview(p)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not look up that code.')
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    if (!preview) return
    setBusy(true)
    setError(null)
    try {
      const joined = await joinLeague(code.trim().toUpperCase())
      const id = joined.id
      reset()
      onJoined(id)
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Could not join the league.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Join a league"
      footer={
        preview ? undefined : (
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={lookUp} loading={busy}>
              Find league
            </Button>
          </>
        )
      }
    >
      {preview ? (
        <LeaguePreviewCard
          preview={preview}
          joining={busy}
          onJoin={join}
          onDecline={() => {
            setPreview(null)
            setError(null)
          }}
        />
      ) : (
        <>
          <p className={s.lead}>Enter the invite code a friend shared with you.</p>
          <TextInput
            label="Invite code"
            value={code}
            placeholder="ABC234"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') lookUp()
            }}
          />
          {error && (
            <Alert variant="error" title="Couldn't find that league">
              {error}
            </Alert>
          )}
        </>
      )}
    </Modal>
  )
}
