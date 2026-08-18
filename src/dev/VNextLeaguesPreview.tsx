import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextLeaguesScreen } from '../vnext/integration/leagues/VNextLeaguesScreen'
import {
  VNextLeaguesLoading,
  VNextLeaguesNotice,
} from '../vnext/integration/leagues/VNextLeaguesStates'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * THE REAL vNEXT LEAGUES, AGAINST THE REAL DATABASE (DEV ONLY).
 *
 * ============================ WHAT IT IS FOR ==============================
 *
 * Stage 9's deterministic worlds prove the design. What none of them can prove
 * is the only question that matters about the integration: CAN THE APPLICATION
 * SUPPLY THIS HONESTLY? For Leagues that question is sharper than for any
 * surface so far, because the thing being supplied is a PERMISSION:
 *
 *   A. does contract 191's `reach` actually arrive on a real season table, and
 *      does it vary between rows the way the model assumes?
 *   B. does a row the server did NOT authorise stay unopenable against real
 *      data, rather than only against a fixture that says so?
 *
 * A fixture can assert anything. A real leaderboard read is the only thing that
 * can show whether the permission the design rests on is really there.
 *
 * IT DOES NOT OPEN A PROFILE, and it could not: Stage 10 owns that surface.
 * Pressing a player REPORTS the id the page emitted, which is what proves the
 * emission carries an id and no display name.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ================
 *
 * The pattern this repository already accepted — `VNextHomePreview`,
 * `VNextMatchesPreview`, `SeasonLeaderboardPreview` and the rest. The component
 * is behind `import.meta.env.DEV` at its import site in `App.tsx`, so a
 * production build resolves that to `false`, tree-shakes the lazy import and
 * emits no chunk. Nothing in the product's navigation points here and there is
 * no flag that turns it on. THE PRODUCTION LEAGUES SURFACES ARE UNTOUCHED.
 *
 * ============================ THE SCOPE LIVES HERE, AND THAT IS THE POINT =
 *
 * `selectedLeagueId` is this harness's state and is passed INTO the screen,
 * because switching table is a different read. The page emits an intent, the
 * host changes the input, a new model arrives. That is the whole loop, and
 * seeing it work here is what says the page was right not to hold it.
 */
export function VNextLeaguesPreview() {
  return (
    <AuthProvider>
      <PreviewBody />
    </AuthProvider>
  )
}

/**
 * `?state=loading|failed` renders that state directly.
 *
 * A read failure needs the database to break, so it cannot be arranged on
 * purpose — and it is what a real player meets on a bad day. IT OVERRIDES THE
 * HARNESS, NOT THE SCREEN: the screen's own state machine is untouched and
 * unmocked; this renders the same presentational components with the same
 * props, so it proves how a state LOOKS and never what decides it.
 */
type ForcedState = 'loading' | 'failed'

function forcedStateFrom(search: string): ForcedState | null {
  const value = new URLSearchParams(search).get('state')
  return value === 'loading' || value === 'failed' ? value : null
}

function PreviewBody() {
  const { userId, loading } = useAuth()
  const forced = forcedStateFrom(window.location.search)

  const [competitionSlug, setCompetitionSlug] = useState('')
  const [seasonSlug, setSeasonSlug] = useState('')
  const [gameCompetitionId, setGameCompetitionId] = useState('')
  const [applied, setApplied] = useState<{
    competitionSlug: string
    seasonSlug: string
    gameCompetitionId: string | null
  } | null>(null)

  // THE SCOPE, HELD BY THE HOST. Null is the season table.
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const onShellIntent = useShellIntentHost(setNote)

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`
            and points `<main aria-labelledby>` at it. */}
        <h2 className={styles.heading}>vNext Leagues — real data</h2>
        <p className={styles.note}>
          Development harness. Reads the live database through the same season
          services the Hub uses, and renders the Stage 9 surface unchanged. Not
          a product route.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (!competitionSlug.trim() || !seasonSlug.trim()) return
            setApplied({
              competitionSlug: competitionSlug.trim(),
              seasonSlug: seasonSlug.trim(),
              gameCompetitionId: gameCompetitionId.trim() || null,
            })
            setSelectedLeagueId(null)
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
            {/* Empty is a REAL state and not a missing input: a player who has
                not joined the game has no game competition, and the season
                table must still render with no chooser above it. */}
            <span>Game competition id (blank = not in the game)</span>
            <input
              value={gameCompetitionId}
              onChange={(event) => setGameCompetitionId(event.target.value)}
              placeholder="uuid — leave blank to see the no-leagues state"
            />
          </label>
          <button type="submit">Render Leagues</button>
        </form>

        <p className={styles.note}>
          {loading ? 'Resolving session…' : userId ? 'Signed in' : 'No session.'}
          {selectedLeagueId === null
            ? ' · showing the season table'
            : ` · showing league ${selectedLeagueId}`}
        </p>
        {note === null ? null : <p className={styles.note}>{note}</p>}
      </header>

      <VNextRoot>
        {forced === 'loading' ? (
          <VNextLeaguesLoading />
        ) : forced === 'failed' ? (
          <VNextLeaguesNotice
            title="We could not load these standings"
            body="The table is there — we just could not read it just now. Trying again usually works."
            onRetry={() => window.location.reload()}
          />
        ) : applied ? (
          <VNextLeaguesScreen
            userId={userId}
            authLoading={loading}
            competitionSlug={applied.competitionSlug}
            seasonSlug={applied.seasonSlug}
            gameCompetitionId={applied.gameCompetitionId}
            selectedLeagueId={selectedLeagueId}
            gameName="Match Predictor"
            onShellIntent={onShellIntent}
            onIntent={(intent) => {
              if (intent.kind === 'scope') {
                setSelectedLeagueId(
                  intent.scope.kind === 'global' ? null : intent.scope.leagueId,
                )
                return
              }
              // STAGE 10 OWNS THE PROFILE. What this proves is that the page
              // emitted an ID and nothing that could be a display name — which
              // is the whole social-identity rule, observable.
              setNote(`Leagues asked to open player id "${intent.playerId}".`)
            }}
          />
        ) : (
          /* Deliberately renders the loading state before anything is applied,
             so the skeleton is the first thing a reviewer sees. */
          <VNextLeaguesScreen
            userId={userId}
            authLoading
            competitionSlug={undefined}
            seasonSlug={undefined}
            gameCompetitionId={null}
            selectedLeagueId={null}
            gameName="Match Predictor"
          />
        )}
      </VNextRoot>
    </div>
  )
}

/**
 * THE HOST FOR THE SHELL'S INTENTS — the same shape `VNextMatchesPreview` uses.
 * A destination intent has nowhere to go yet and is REPORTED rather than faked
 * into a legacy route that looks nothing like the vNext page.
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
          navigate('/account')
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
      return `Destination "${intent.destination}" — Home, Matches and the Match Predictor have their own harnesses; Games is a later stage.`
    case 'context':
      return `Switch competition to "${intent.contextId}" — the connected shell states one competition, so there is nothing to switch to yet.`
    case 'game':
      return `Open ${intent.game} in "${intent.contextId}".`
    case 'league':
      return `Open league "${intent.leagueId}" — the page's own chooser is the one that changes the table.`
    default:
      return 'Handled by the harness.'
  }
}
