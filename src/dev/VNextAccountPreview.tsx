import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { VNextAccountScreen } from '../vnext/integration/account/VNextAccountScreen'
import type { ShellIntent } from '../vnext/models/shell'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import styles from './VNextHomePreview.module.css'

/**
 * vNEXT ACCOUNT AGAINST REAL DATA — a `/dev` harness.
 *
 * ============================ WHAT IT IS FOR ============================
 *
 * The deterministic worlds in Storybook are the review surface. This is the
 * other half: three reads meeting a real account, where the shapes the
 * decoders handle were established by reading their models rather than by
 * seeing a payload.
 *
 * The two questions worth pointing it at a real account for:
 *
 *   A. does any follow arrive UNNAMEABLE in practice, or is that state
 *      theoretical? A follow the catalogue no longer lists and the player never
 *      played is the case the surface is built around, and this is the only
 *      place to find out whether real accounts have one;
 *   B. does contract 161 return a season with a null slug — an archived season
 *      whose row must offer no button?
 *
 * ============================ IT READS AND DOES NOT WRITE ===============
 *
 * Every read here is a read. `setCompetitionFollow`, `setPinnedRival` and
 * `setOnboardingProgress` all exist beside the preferences read and NONE of
 * them is reachable from this page — the surface emits `open-season` and
 * nothing else. If a write is ever wired in, this docblock gains the warning
 * Stage 12's Championship harness carries, and the page gains a visible one.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ==============
 *
 * Behind `import.meta.env.DEV` at its import site in `App.tsx`, so a production
 * build resolves that to `false`, tree-shakes the lazy import and emits no
 * chunk. THE PRODUCTION ACCOUNT SURFACES ARE UNTOUCHED — `/account`,
 * `/profile` and `/more` all still render exactly what they rendered before.
 */
export function VNextAccountPreview() {
  return (
    <AuthProvider>
      <VNextRoot>
        <AccountHarness />
      </VNextRoot>
    </AuthProvider>
  )
}

function AccountHarness() {
  const { userId, displayName, loading, signOut } = useAuth()
  const [note, setNote] = useState('')
  const onShellIntent = useShellIntentHost(setNote)
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Account — real data</h2>
        <p className={styles.note}>
          Development harness. Reads contract 157
          <code> get_my_preferences</code>, contract 161
          <code> get_my_season_history</code> and contract 147
          <code> get_published_weekly_seasons</code>, and renders the Stage 13
          surface unchanged. Not a product route, and every call it makes is a
          read.
        </p>
        <p className={styles.note}>
          <strong>The state worth looking for is an unnameable follow.</strong>{' '}
          Contract 157 returns a follow as a bare tournament id; a name comes
          from the catalogue or from the participation history, and a follow on
          an unpublished season you never played is in neither. The surface says
          so rather than showing the id.
        </p>
        {note ? <p className={styles.note}>{note}</p> : null}
      </header>

      <VNextAccountScreen
        userId={userId}
        authLoading={loading}
        displayName={displayName}
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (intent.kind === 'open-season') {
            navigate(`/competitions/${intent.competitionSlug}/${intent.seasonKey}`)
            return
          }
          // NAMED, NOT A FALL-THROUGH. Signing out was reached by "anything
          // that is not open-season", so a third intent added later would have
          // silently ended the session. It is the one action here that cannot
          // be undone by pressing back.
          if (intent.kind === 'sign-out') {
            // REALLY SIGNS OUT. The page owns the control and the wording; the
            // session belongs to the auth provider, and this is the host
            // performing it — the same division every write in this lane uses.
            setNote('Signing out…')
            void signOut()
            return
          }
          setNote(`Intent "${(intent as { kind: string }).kind}" — reported rather than routed.`)
        }}
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
          navigate('/competitions')
          return
        case 'account':
          // ALREADY HERE. Every other harness routes this to the legacy
          // `/account`, which is the escape hatch Stage 13 exists to close.
          report('You are already on the Account surface.')
          return
        default:
          report(`Shell intent "${intent.kind}" — reported rather than routed.`)
      }
    },
    [navigate, report],
  )
}
