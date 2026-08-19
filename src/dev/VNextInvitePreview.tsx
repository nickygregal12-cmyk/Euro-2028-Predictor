import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextInviteScreen } from '../vnext/integration/invite/VNextInviteScreen'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * vNEXT INVITE AGAINST REAL DATA — a `/dev` harness.
 *
 * ============================ IT WRITES, AND THE WRITE IS A JOIN ========
 *
 * ACCEPTING AN INVITATION HERE REALLY JOINS. `useInviteCode` dispatches on the
 * server's own `joinWith`, so a league invite calls `join_league` and a private
 * competition calls `join_private_competition` — against the account this
 * browser is signed in as, in whatever container the code names.
 *
 * A join is not trivially undone: leaving a game is its own act with its own
 * rules, and a competition that has started may not take the player back at all
 * (`allow_rejoin` bites once a competition is running). So paste a code you are
 * willing to be a member of.
 *
 * Looking a code UP is a read and changes nothing. Only the accept writes.
 *
 * ============================ WHAT IS WORTH CHECKING ====================
 *
 *   A. does a real league invite ever arrive with `requiresGameEntry` true?
 *      That is the state the surface is built around — it sends the player to
 *      the game rather than offering a button the database would refuse;
 *   B. does a rotated or used-up code resolve to `notfound` rather than to an
 *      error? The two are different states here and only one is retryable.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ==============
 *
 * Behind `import.meta.env.DEV` at its import site in `App.tsx`. THE PRODUCTION
 * `/join/:code` LANDING IS UNTOUCHED, including its pending-invite handling
 * across sign-up, which is routing and therefore Stage 14's.
 */
export function VNextInvitePreview() {
  return (
    <AuthProvider>
      <VNextRoot>
        <InviteHarness />
      </VNextRoot>
    </AuthProvider>
  )
}

function InviteHarness() {
  const { userId, loading } = useAuth()
  const [params, setParams] = useSearchParams()
  const [note, setNote] = useState('')
  const onShellIntent = useShellIntentHost(setNote)
  const navigate = useNavigate()

  const code = params.get('code') ?? undefined

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Invite — real data</h2>
        <p className={styles.note}>
          Development harness. Resolves an invite code through{' '}
          <code>resolve_invite_code</code> and renders the Stage 13 landing
          unchanged. Not a product route.
        </p>
        <p className={styles.warning}>
          <strong>Accepting really joins.</strong> The hook dispatches on the
          server’s own <code>joinWith</code>, so this calls{' '}
          <code>join_league</code> or <code>join_private_competition</code>{' '}
          against the account you are signed in as. Leaving again is its own act,
          and a competition that has started may not take you back. Looking a
          code up changes nothing.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            setParams({ code: String(data.get('code') ?? '') })
          }}
        >
          <label className={styles.field}>
            <span>Invite code</span>
            <input name="code" defaultValue={code ?? ''} />
          </label>
          <button type="submit">Look it up</button>
        </form>
        {note ? <p className={styles.note}>{note}</p> : null}
      </header>

      <VNextInviteScreen
        userId={userId}
        authLoading={loading}
        code={code}
        onShellIntent={onShellIntent}
        onGoHome={() => navigate('/dev/vnext-home')}
        onOpenGame={() => setNote('Open-game intent — reported rather than routed.')}
        onJoined={(result) =>
          setNote(
            result.kind === 'league'
              ? `Joined league ${result.leagueId}.`
              : `Joined competition ${result.competitionId ?? '(unnamed)'}.`,
          )
        }
      />
    </div>
  )
}

function useShellIntentHost(report: (message: string) => void) {
  const navigate = useNavigate()
  return useCallback(
    (intent: ShellIntent) => {
      switch (intent.kind) {
        case 'discover':
          navigate('/dev/vnext-discovery')
          return
        case 'account':
          navigate('/dev/vnext-account')
          return
        default:
          report(`Shell intent "${intent.kind}" — reported rather than routed.`)
      }
    },
    [navigate, report],
  )
}
