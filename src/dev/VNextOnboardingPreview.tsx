import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextOnboardingScreen } from '../vnext/integration/onboarding/VNextOnboardingScreen'
import { VNextShellProvider } from '../vnext/app/VNextShellProvider'
import { buildShellModel } from '../vnext/integration/shell/buildShellModel'
import styles from './VNextHomePreview.module.css'

/**
 * vNEXT ONBOARDING AGAINST REAL DATA — a `/dev` harness.
 *
 * ============================ IT READS, AND IT DOES NOT WRITE ===========
 *
 * The screen writes nothing at all — not the progress stamp, not the follows,
 * not the game entries — because the commit order lives in
 * `OnboardingJourney` and this lane keeps no second copy of it. So this harness
 * has no Finish that saves: pressing it REPORTS the draft it would have
 * committed, which is the honest thing for a lane that has not cut over and is
 * also the more useful thing to inspect.
 *
 * Concretely, that means running this harness cannot alter your onboarding
 * state, your follows or your game memberships. It is safe to walk all four
 * steps on a real account.
 *
 * ============================ WHAT IS WORTH CHECKING ====================
 *
 *   A. does a REAL catalogue produce readable rows? The fixtures have two
 *      competitions with short names; twenty published seasons with long ones
 *      is the case a fixture cannot honestly depict;
 *   B. does a real account that has already joined a game show it as a fact
 *      with no control? That pairing is the surface's binding rule and it comes
 *      from the membership read, not from the draft;
 *   C. does the club step's per-competition read arrive fast enough to be worth
 *      doing on arrival at that step, or does "Loading clubs…" sit there?
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ==============
 *
 * Behind `import.meta.env.DEV` at its import site in `App.tsx`. THE PRODUCTION
 * `/welcome` ROUTE IS UNTOUCHED: `WelcomePage` still runs `OnboardingJourney`,
 * still owns the `welcomed_at` gate and still consumes the pending invite.
 * Repointing it is routing, and routing is Stage 14's.
 */
export function VNextOnboardingPreview() {
  return (
    <AuthProvider>
      <VNextRoot>
        <OnboardingHarness />
      </VNextRoot>
    </AuthProvider>
  )
}

function OnboardingHarness() {
  const { userId, loading, displayName } = useAuth()
  const navigate = useNavigate()
  const [note, setNote] = useState('')

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Onboarding — real data</h2>
        <p className={styles.note}>
          Development harness. Reads the published catalogue, your memberships
          and your stored preferences, and renders the Stage 13 onboarding
          unchanged. Not a product route.
        </p>
        <p className={styles.note}>
          <strong>Nothing here saves.</strong> Finish reports the draft it would
          have committed rather than committing it — the commit belongs to{' '}
          <code>OnboardingJourney</code>, which is the only copy of it. Walking
          all four steps cannot change your account.
        </p>
        {note ? <p className={styles.note}>{note}</p> : null}
      </header>

      {/* A SHELL MODEL, SO THE CHROME IS REAL. Without one the shell resolves
          to null, no player is known, and neither account button renders — so
          this harness could not exercise the very intent Stage 13 exists to
          answer, and the structural scan had nothing to check it against. */}
      <VNextShellProvider
        model={buildShellModel({
          competition: null,
          playerName: displayName,
          outstandingGames: null,
          canNavigateAway: true,
          // The onboarding preview is one screen with no competitions behind it.
          elsewhere: null,
        })}
        onIntent={(intent) => {
          if (intent.kind === 'account') {
            navigate('/dev/vnext-account')
            return
          }
          setNote(`Shell intent "${intent.kind}" — reported rather than routed.`)
        }}
      >
      <VNextOnboardingScreen
        userId={userId}
        authLoading={loading}
        displayName={displayName}
        // Always idle: there is no host commit here, because there is no host
        // write. The commit states are exercised in Storybook, where they can
        // be depicted without inventing a server that refused something.
        commit={{ kind: 'idle' }}
        onStep={(step) => setNote(`Reached step "${step}" — the progress stamp is the host's.`)}
        onFinish={({ draft, catalogue }) => {
          const named = draft.followed
            .map((key) => catalogue.find((entry) => entry.seasonRowName === key)?.name ?? key)
            .join(', ')
          setNote(
            draft.followed.length === 0
              ? 'Finish: nothing chosen. That is a complete outcome, and nothing was written.'
              : `Finish: would follow ${named}. Nothing was written.`,
          )
        }}
        onLeave={() => navigate('/dev/vnext-games')}
      />
      </VNextShellProvider>
    </div>
  )
}
