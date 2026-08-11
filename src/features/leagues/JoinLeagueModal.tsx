import { useState } from 'react'
import { Modal, TextInput, Button, Alert } from '../../design-system'
import { InvitePreviewCard } from './InvitePreviewCard'
import { useInviteCode, type InviteJoinResult } from './useInviteCode'
import s from './leagueForms.module.css'

export type JoinLeagueModalProps = {
  open: boolean
  onClose: () => void
  /** Called with what was actually joined, so the caller can navigate. */
  onJoined: (joined: InviteJoinResult) => void
}

/**
 * Code entry — the fallback path when someone has a code but not the link
 * (design-system §6: invite links are primary).
 *
 * IT IS NO LONGER LEAGUE-ONLY, AND THAT IS THE POINT OF `MIG-UI-07`. Enter a
 * code → see what it is → join it. What "it" is comes from
 * `resolve_invite_code`, so one entry point answers for a private league, a
 * private Last Man Standing and a private Championship without the player
 * needing to know which they were sent. Before this, a Last Man Standing code
 * pasted here was answered "that code doesn't match a league", which was both
 * true and useless.
 *
 * THE COPY DOES NOT SAY "LEAGUE" ANY MORE, anywhere a code might not be one.
 */
export function JoinLeagueModal({ open, onClose, onJoined }: JoinLeagueModalProps) {
  const [code, setCode] = useState('')
  const { state, joining, resolve, accept, reset } = useInviteCode()

  function close() {
    setCode('')
    reset()
    onClose()
  }

  async function join() {
    const joined = await accept(code)
    if (!joined) return
    setCode('')
    reset()
    onJoined(joined)
  }

  const message =
    state.status === 'error'
      ? state.message
      : state.status === 'notfound'
        ? // Identical for unknown, malformed and rotated codes. The server has
          // made them indistinguishable on purpose; saying which would undo it.
          'That code doesn’t match anything. Check it and try again.'
        : null

  return (
    <Modal
      open={open}
      onClose={close}
      title="Join with a code"
      footer={
        state.status === 'ready' ? undefined : (
          <>
            <Button variant="secondary" onClick={close} disabled={state.status === 'looking'}>
              Cancel
            </Button>
            <Button onClick={() => void resolve(code)} loading={state.status === 'looking'}>
              Find it
            </Button>
          </>
        )
      }
    >
      {state.status === 'ready' ? (
        <InvitePreviewCard
          invite={state.invite}
          joining={joining}
          onJoin={() => void join()}
          onDecline={() => {
            setCode('')
            reset()
          }}
        />
      ) : (
        <>
          <p className={s.lead}>Enter the invite code a friend shared with you.</p>
          <TextInput
            label="Invite code"
            value={code}
            placeholder="ABC234DEF567"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void resolve(code)
            }}
          />
          {message ? (
            <Alert variant="error" title="Couldn’t use that code">
              {message}
            </Alert>
          ) : null}
        </>
      )}
    </Modal>
  )
}
