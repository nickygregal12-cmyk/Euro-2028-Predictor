import { useState } from 'react'
import { Modal, TextInput, Button, Alert } from '../../design-system'
import { createLeague, type CreatedLeague } from '../../services/supabase/leagues'
import { InvitePanel } from './InvitePanel'
import s from './leagueForms.module.css'

export type CreateLeagueModalProps = {
  open: boolean
  onClose: () => void
  tournamentId: string
  // Called when the user finishes the share step and opens the new league.
  onView: (leagueId: string) => void
}

const NAME_MAX = 40

/**
 * Create-league flow: name → created → straight into the share moment (invite
 * link + code), per design-system §6 ("the post-create moment is the invite
 * moment"). The modal owns the two-step state; the parent handles navigation
 * into the new league.
 */
export function CreateLeagueModal({ open, onClose, tournamentId, onView }: CreateLeagueModalProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedLeague | null>(null)

  function reset() {
    setName('')
    setSubmitting(false)
    setError(null)
    setCreated(null)
  }

  function close() {
    reset()
    onClose()
  }

  async function submit() {
    const trimmed = name.trim()
    if (trimmed.length < 1) {
      setError('Give your league a name.')
      return
    }
    if (trimmed.length > NAME_MAX) {
      setError(`Keep the name to ${NAME_MAX} characters or fewer.`)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const league = await createLeague(tournamentId, trimmed)
      setCreated(league)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the league. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <Modal
        open={open}
        onClose={close}
        title="League created"
        footer={
          <Button fullWidth onClick={() => { const id = created.id; reset(); onView(id) }}>
            View league
          </Button>
        }
      >
        <p className={s.lead}>
          <strong className={s.leagueName}>{created.name}</strong> is ready. Share the invite so
          your mates can join.
        </p>
        <InvitePanel leagueName={created.name} code={created.inviteCode} mode="full" />
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Create a league"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting}>
            Create
          </Button>
        </>
      }
    >
      <div className={s.field}>
        <TextInput
          label="League name"
          value={name}
          maxLength={NAME_MAX}
          placeholder="e.g. The Office Sweepstake"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
        <span className={s.counter}>
          {name.trim().length}/{NAME_MAX}
        </span>
      </div>
      {error && (
        <Alert variant="error" title="Couldn't create the league">
          {error}
        </Alert>
      )}
    </Modal>
  )
}
