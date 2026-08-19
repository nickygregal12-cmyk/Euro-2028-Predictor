import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextPredictorScreen } from '../vnext/integration/predictor/VNextPredictorScreen'
import {
  VNextPredictorLoading,
  VNextPredictorNotice,
} from '../vnext/integration/predictor/VNextPredictorStates'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * THE REAL vNEXT MATCH PREDICTOR, AGAINST THE REAL DATABASE (DEV ONLY).
 *
 * WHY THIS EXISTS. The deterministic scenarios prove the design; only real reads
 * can answer whether the application can supply this page honestly — and that
 * cannot be answered by switching production's Match Predictor over to find out.
 *
 * WHY IT IS `/dev` AND NOT A ROUTE. It follows the pattern this repository already
 * accepted for exactly this problem — `SeasonMatchPredictorPreview`,
 * `VNextHomePreview` and the rest. The component is behind `import.meta.env.DEV`
 * at its import site in `App.tsx`, so a production build resolves that to `false`,
 * tree-shakes the lazy import and emits no chunk. Nothing in the product's
 * navigation points here and there is no flag that turns it on. The production
 * Match Predictor is untouched: this PR proves the integration and decides nothing
 * about rollout.
 *
 * WHY IT ASKS FOR SLUGS. `get_season_play_context` is addressed by a competition
 * slug and a season key, which is how every other season surface reaches a season.
 * Typing them is the honest cost of a harness with no router state — and it means
 * one reviewer can compare two competitions without a rebuild.
 *
 * WHY IT ASKS FOR A MATCHWEEK. The interesting states of this page are ATTACHED TO
 * PARTICULAR MATCHWEEKS: an open one, one that has locked, one that has settled.
 * Leaving the field blank opens the matchweek the application says is playable,
 * which is the ordinary case; naming one is how the locked and settled states get
 * looked at against real data rather than only in a fixture.
 *
 * IT USES THE APPLICATION'S OWN AUTH. `AuthProvider` is the existing authority and
 * it is mounted here rather than reimplemented, so a dev session established the
 * ordinary way is the session the page sees. vNext gets no auth of its own —
 * `VNextPredictorScreen` takes a user id as an input and has no opinion about
 * where it came from.
 *
 * IT REUSES `VNextHomePreview.module.css` rather than adding a second identical
 * harness stylesheet. This chrome is tooling, it is not product, and two copies of
 * it would be two things to keep in step for no gain.
 */
export function VNextMatchPredictorPreview() {
  return (
    <AuthProvider>
      <PreviewBody />
    </AuthProvider>
  )
}

/**
 * A STATE OVERRIDE, FOR THE STATES THAT ARE HARD TO CAUSE ON PURPOSE.
 *
 * `?state=loading|failed|noCompetition|seasonOver` renders that state directly. It
 * exists because the interesting ones are the ones you cannot arrange: a read
 * failure needs the database to break, and "no competition" needs a season that
 * does not exist. Both have to be looked at — they are the states a real player is
 * most likely to meet on a bad day, and the ones nobody screenshots.
 *
 * IT OVERRIDES THE HARNESS, NOT THE SCREEN. `VNextPredictorScreen`'s own state
 * machine is untouched and unmocked; this renders the same two presentational
 * components the screen renders, with the same props. So it proves how a state
 * LOOKS and never what decides it.
 */
type ForcedState = 'loading' | 'failed' | 'noCompetition' | 'seasonOver'

function forcedStateFrom(search: string): ForcedState | null {
  const value = new URLSearchParams(search).get('state')
  return value === 'loading' ||
    value === 'failed' ||
    value === 'noCompetition' ||
    value === 'seasonOver'
    ? value
    : null
}

function PreviewBody() {
  const { userId, loading } = useAuth()
  const forced = forcedStateFrom(window.location.search)
  const [competitionSlug, setCompetitionSlug] = useState('')
  const [seasonSlug, setSeasonSlug] = useState('')
  const [matchweek, setMatchweek] = useState('')
  const [applied, setApplied] = useState<{
    competitionSlug: string
    seasonSlug: string
    matchweek: number | undefined
  } | null>(null)

  const [shellNote, setShellNote] = useState<string | null>(null)
  const onShellIntent = useShellIntentHost(setShellNote)

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>` and
            points `<main aria-labelledby>` at it. A harness heading that claimed
            `h1` too would give the document two — which is exactly the contract
            this page's own review checks for, and the harness must not be the
            thing that breaks it. */}
        <h2 className={styles.heading}>vNext Match Predictor — real data</h2>
        <p className={styles.note}>
          Development harness. Reads the live database through the same season
          services and the same Match Predictor gateway, hook and commands the
          production page uses, and renders the vNext surface over them. Not a
          product route.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (!competitionSlug.trim() || !seasonSlug.trim()) return
            const requested = Number(matchweek.trim())
            setApplied({
              competitionSlug: competitionSlug.trim(),
              seasonSlug: seasonSlug.trim(),
              matchweek: Number.isInteger(requested) && requested >= 1 ? requested : undefined,
            })
          }}
        >
          <label className={styles.field}>
            <span>Competition slug</span>
            <input
              value={competitionSlug}
              onChange={(event) => setCompetitionSlug(event.target.value)}
              placeholder="scottish-premiership"
            />
          </label>
          <label className={styles.field}>
            <span>Season key</span>
            <input
              value={seasonSlug}
              onChange={(event) => setSeasonSlug(event.target.value)}
              placeholder="2026-27"
            />
          </label>
          <label className={styles.field}>
            <span>Matchweek (optional)</span>
            <input
              value={matchweek}
              onChange={(event) => setMatchweek(event.target.value)}
              inputMode="numeric"
              placeholder="blank for the playable one"
            />
          </label>
          <button type="submit">Render predictor</button>
        </form>
        <p className={styles.note}>
          {loading
            ? 'Resolving session…'
            : userId
              ? 'Signed in.'
              : 'No session. The page will render its signed-out state.'}
        </p>
        {/* WHAT THE SHELL ASKED FOR, WHERE THE HARNESS CANNOT ANSWER IT. The
            selected shell emits an intent for every control; Explore and the
            account go to real routes, and everything else is a vNext surface a
            later stage builds. Printing it is the honest thing a harness can do
            — a placeholder page pretending to be Matches would be a design
            nobody asked for. */}
        {shellNote === null ? null : <p className={styles.note}>{shellNote}</p>}
      </header>

      {/*
        The harness frame is a plain full-width container rather than
        `WorkshopCanvas`' device board: this is a real-data review, and the browser
        window IS the container being reviewed. `VNextRoot` is still required —
        every vNext token is declared on its `data-vnext` element and nothing
        renders correctly outside one.
      */}
      <VNextRoot>
        {forced === 'loading' ? (
          <VNextPredictorLoading />
        ) : forced === 'failed' ? (
          <VNextPredictorNotice
            title="This matchweek is unavailable"
            body="We could not read this competition season just now."
            onRetry={() => window.location.reload()}
          />
        ) : forced === 'noCompetition' ? (
          <VNextPredictorNotice
            title="No competition to predict"
            body="Pick a competition and season, and this is where its matchweek card will be."
          />
        ) : forced === 'seasonOver' ? (
          <VNextPredictorNotice
            title="This season has no matchweek left to play"
            body="Every matchweek has passed its lock. Results and standings stay available; there is nothing further to enter."
          />
        ) : (
          <VNextPredictorScreen
            userId={userId}
            // Deliberately reports auth as still resolving until slugs are
            // applied, so the skeleton is the first thing a reviewer sees and gets
            // looked at rather than flashing past.
            authLoading={loading || applied === null}
            competitionSlug={applied?.competitionSlug}
            seasonSlug={applied?.seasonSlug}
            matchweek={applied?.matchweek}
            onShellIntent={onShellIntent}
          />
        )}
      </VNextRoot>
    </div>
  )
}

/**
 * THE HOST FOR THE SHELL'S INTENTS — the connected proof that the selected
 * architecture is route-agnostic.
 *
 * `VNextShell` emits a `ShellIntent` and holds no URL. Here is one host turning
 * those into the application's OWN routes, in eight lines, without vNext
 * learning that a router exists. In Storybook the same intents go to `useState`;
 * after the production cutover stage they will go to the real navigation. None
 * of those is the shell's business, which is the point.
 *
 * DISCOVERY AND THE ACCOUNT GO SOMEWHERE REAL. `/competitions` is
 * `ExploreCompetitionsPage` and `/account` is `AccountPage`, both of which
 * already exist — so this harness can supply a handler honestly, and the shell
 * therefore offers the controls. A destination intent has nowhere to go yet:
 * Matches, Games and Leagues are Stage 8+ surfaces, so it is REPORTED rather
 * than faked into a legacy route that looks nothing like the vNext page.
 */
function useShellIntentHost(report: (message: string) => void) {
  const navigate = useNavigate()
  return useCallback(
    (intent: ShellIntent) => {
      switch (intent.kind) {
        case 'discover':
          navigate('/competitions')
          return
        case 'account':
          // THE ESCAPE HATCH THIS STAGE EXISTS TO CLOSE. This used to route to
          // the LEGACY `/account`, so pressing your own name inside a vNext
          // surface dropped you out of vNext entirely. There is a vNext answer
          // now, and it is where the intent goes.
          navigate('/dev/vnext-account')
          return
        default:
          report(describeIntent(intent))
      }
    },
    [navigate, report],
  )
}

function describeIntent(intent: ShellIntent): string {
  switch (intent.kind) {
    case 'destination':
      return `Destination "${intent.destination}" — a vNext surface later stages build.`
    case 'context':
      return `Switch competition to "${intent.contextId}" — the connected shell states one competition, so there is nothing to switch to yet.`
    case 'game':
      return `Open ${intent.game} in "${intent.contextId}".`
    case 'league':
      return `Open league "${intent.leagueId}".`
    default:
      // `discover` and `account` are handled by the host above and never reach
      // this describer; the branch exists so the union stays exhaustive.
      return 'Handled by the harness.'
  }
}
