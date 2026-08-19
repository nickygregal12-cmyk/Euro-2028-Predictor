import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextMatchesScreen } from '../vnext/integration/matches/VNextMatchesScreen'
import { VNextMatchCentreScreen } from '../vnext/integration/matches/VNextMatchCentreScreen'
import {
  VNextMatchesLoading,
  VNextMatchesNotice,
} from '../vnext/integration/matches/VNextMatchesStates'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * THE REAL vNEXT MATCHES AND MATCH CENTRE, AGAINST THE REAL DATABASE (DEV ONLY).
 *
 * ============================ WHAT IT IS FOR ==============================
 *
 * Stage 8's deterministic worlds prove the design. What none of them can prove
 * is the only question that matters about the integration: CAN THE APPLICATION
 * SUPPLY THIS HONESTLY? That has to be answered against real reads — a real
 * competition's fixtures, a real fixture opened by its own id — and it cannot
 * be answered by switching the production Matches surface over to find out.
 *
 * IT PROVES THE TWO THINGS §36 ASKS FOR, and it proves them one after the
 * other, in the same harness:
 *
 *   A. real Competition Matches, from `get_season_play_context` +
 *      `get_season_fixtures`;
 *   B. real fixture → Match Centre BY CANONICAL FIXTURE ID, through contract
 *      148's `get_season_fixture` and nothing else.
 *
 * Pressing a fixture in the list hands its id to the Match Centre screen, and
 * the id also goes into the harness's own field — so a reviewer can copy it,
 * reload the page with `?fixture=<id>` and watch it resolve from the id alone.
 * That is the deep-refresh property, demonstrated rather than asserted.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ================
 *
 * The pattern this repository already accepted for exactly this problem —
 * `VNextHomePreview`, `SeasonLeaderboardPreview`, `SeasonStandingsPreview` and
 * the rest. The component is behind `import.meta.env.DEV` at its import site in
 * `App.tsx`, so a production build resolves that to `false`, tree-shakes the
 * lazy import and emits no chunk. Nothing in the product's navigation points
 * here and there is no flag that turns it on. THE PRODUCTION MATCHES SURFACE
 * AND MATCH CENTRE ARE UNTOUCHED: this proves the integration and decides
 * nothing about rollout.
 *
 * ============================ IT USES THE APPLICATION'S OWN AUTH ==========
 *
 * `AuthProvider` is the existing authority and is mounted rather than
 * reimplemented, so a dev session established the ordinary way is the session
 * these surfaces see. vNext gets no auth of its own.
 */
export function VNextMatchesPreview() {
  return (
    <AuthProvider>
      <PreviewBody />
    </AuthProvider>
  )
}

/**
 * `?state=loading|failed|notFound` renders that state directly.
 *
 * The interesting states are the ones you cannot arrange on purpose: a read
 * failure needs the database to break, and `notFound` needs a fixture id that
 * does not exist — which is at least typeable, and is left typeable. Both have
 * to be looked at, and both are what a real player meets on a bad day.
 *
 * IT OVERRIDES THE HARNESS, NOT THE SCREEN. The screens' own state machines are
 * untouched and unmocked; this renders the same two presentational components
 * with the same props, so it proves how a state LOOKS and never what decides it.
 */
type ForcedState = 'loading' | 'failed' | 'notFound'

function forcedStateFrom(search: string): ForcedState | null {
  const value = new URLSearchParams(search).get('state')
  return value === 'loading' || value === 'failed' || value === 'notFound' ? value : null
}

function fixtureFrom(search: string): string {
  return new URLSearchParams(search).get('fixture') ?? ''
}

function PreviewBody() {
  const { userId, loading } = useAuth()
  const search = window.location.search
  const forced = forcedStateFrom(search)

  const [competitionSlug, setCompetitionSlug] = useState('')
  const [seasonSlug, setSeasonSlug] = useState('')
  // Pre-filled from the query string, so a deep link into one fixture resolves
  // on first paint — which is the property being demonstrated.
  const [fixtureId, setFixtureId] = useState(() => fixtureFrom(search))
  const [applied, setApplied] = useState<{
    competitionSlug: string
    seasonSlug: string
  } | null>(null)
  const [openFixture, setOpenFixture] = useState<string | null>(() => fixtureFrom(search) || null)

  const [shellNote, setShellNote] = useState<string | null>(null)
  const onShellIntent = useShellIntentHost(setShellNote)

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`
            and points `<main aria-labelledby>` at it. A harness heading that
            claimed `h1` too would give the document two — the exact contract
            the browser suite checks, and the harness must not be what breaks
            it. */}
        <h2 className={styles.heading}>vNext Matches — real data</h2>
        <p className={styles.note}>
          Development harness. Reads the live database through the same season
          services the Hub uses, and renders the Stage 8 surfaces unchanged. Not
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
            })
            setOpenFixture(null)
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
          <button type="submit">Render Matches</button>
        </form>

        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (!fixtureId.trim()) return
            setOpenFixture(fixtureId.trim())
          }}
        >
          <label className={styles.field}>
            {/* THE WHOLE ADDRESSABILITY CLAIM, IN ONE FIELD. Contract 148 is
                addressed by the fixture id and nothing else: no competition, no
                season, no date, no window. Typing an id here — or arriving with
                `?fixture=<id>` — resolves the same match either way. */}
            <span>Fixture id (contract 148 — the only thing a Match Centre needs)</span>
            <input
              value={fixtureId}
              onChange={(event) => setFixtureId(event.target.value)}
              placeholder="uuid — opening a fixture below fills this in"
            />
          </label>
          <button type="submit">Open Match Centre</button>
          {openFixture ? (
            <button type="button" onClick={() => setOpenFixture(null)}>
              Back to Matches
            </button>
          ) : null}
        </form>

        <p className={styles.note}>
          {loading ? 'Resolving session…' : userId ? 'Signed in' : 'No session.'}
        </p>
        {shellNote === null ? null : <p className={styles.note}>{shellNote}</p>}
      </header>

      <VNextRoot>
        {forced === 'loading' ? (
          <VNextMatchesLoading />
        ) : forced === 'failed' ? (
          <VNextMatchesNotice
            title="We could not load these matches"
            body="The fixtures are there — we just could not read them just now. Trying again usually works."
            onRetry={() => window.location.reload()}
          />
        ) : forced === 'notFound' ? (
          <VNextMatchesNotice
            heading="Match Centre"
            title="This match could not be opened"
            body="It may have been removed from the calendar, or it belongs to a different competition. The competition's own fixture list is the place to find it."
          />
        ) : openFixture ? (
          <VNextMatchCentreScreen
            userId={userId}
            authLoading={loading}
            fixtureId={openFixture}
            competitionSlug={applied?.competitionSlug}
            seasonSlug={applied?.seasonSlug}
            onShellIntent={onShellIntent}
            onIntent={(intent) => {
              if (intent.kind === 'link' && intent.link === 'competition-matches') {
                setOpenFixture(null)
                return
              }
              setShellNote(`Match Centre asked for "${intent.kind}".`)
            }}
          />
        ) : applied ? (
          <VNextMatchesScreen
            userId={userId}
            authLoading={loading}
            competitionSlug={applied.competitionSlug}
            seasonSlug={applied.seasonSlug}
            onShellIntent={onShellIntent}
            onIntent={(intent) => {
              if (intent.kind !== 'openMatch') return
              // THE CANONICAL ID, AND NOTHING ELSE, CROSSES THIS BOUNDARY. Not
              // the clubs, not the date, not the row's position — §29's rule,
              // demonstrated by the harness having nothing else to pass.
              setFixtureId(intent.matchId)
              setOpenFixture(intent.matchId)
            }}
          />
        ) : (
          /* Deliberately renders the loading state before anything is applied,
             so the skeleton is the first thing a reviewer sees and gets looked
             at rather than flashing past. */
          <VNextMatchesScreen
            userId={userId}
            authLoading
            competitionSlug={undefined}
            seasonSlug={undefined}
          />
        )}
      </VNextRoot>
    </div>
  )
}

/**
 * THE HOST FOR THE SHELL'S INTENTS — the same eight lines `VNextHomePreview`
 * uses, and the same point: the shell says what the player asked for and the
 * host decides what it means. Discovery and the account go somewhere real;
 * a destination intent has nowhere to go yet and is REPORTED rather than faked
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
      return `Destination "${intent.destination}" — Home and the Match Predictor have their own harnesses; Games and Leagues are later stages.`
    case 'context':
      return `Switch competition to "${intent.contextId}" — the connected shell states one competition, so there is nothing to switch to yet.`
    case 'game':
      return `Open ${intent.game} in "${intent.contextId}".`
    case 'league':
      return `Open league "${intent.leagueId}".`
    default:
      return 'Handled by the harness.'
  }
}
