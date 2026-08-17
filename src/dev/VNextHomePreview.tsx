import { useState } from 'react'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextHomeScreen } from '../vnext/integration/home/VNextHomeScreen'
import {
  VNextHomeLoading,
  VNextHomeNotice,
} from '../vnext/integration/home/VNextHomeStates'
import styles from './VNextHomePreview.module.css'

/**
 * THE REAL vNEXT HOME, AGAINST THE REAL DATABASE (DEV ONLY).
 *
 * WHY THIS EXISTS. Stages 3 to 5 proved the design, the model and the shell on
 * deterministic fixtures. What none of them could prove is the only question
 * Stage 6 asks: can the application actually supply this Home honestly? That has
 * to be answered against real reads, and it cannot be answered by switching
 * production Home over to find out.
 *
 * WHY IT IS `/dev` AND NOT A ROUTE. It follows the pattern this repository
 * already accepted for exactly this problem — `SeasonLeaderboardPreview`,
 * `SeasonMatchPredictorPreview`, `SeasonStandingsPreview` and the rest. The
 * component is behind `import.meta.env.DEV` at its import site in `App.tsx`, so
 * the production build resolves that to `false`, tree-shakes the lazy import and
 * emits no chunk. Nothing in the product's navigation points here, and there is
 * no flag that turns it on. Production Home is untouched: this PR proves the
 * integration and decides nothing about rollout.
 *
 * WHY IT ASKS FOR SLUGS. `get_season_play_context` is addressed by a competition
 * slug and a season key, which is how every other season surface reaches a
 * season. Typing them is the honest cost of a harness with no router state — and
 * it means one reviewer can compare two competitions without a rebuild.
 *
 * IT USES THE APPLICATION'S OWN AUTH. `AuthProvider` is the existing authority
 * and it is mounted here rather than reimplemented, so a dev session established
 * the ordinary way is the session Home sees. vNext gets no auth of its own —
 * `useVNextHomeSource` takes a user id as an input and has no opinion about
 * where it came from.
 */
export function VNextHomePreview() {
  return (
    <AuthProvider>
      <PreviewBody />
    </AuthProvider>
  )
}

/**
 * A STATE OVERRIDE, FOR REVIEWING THE STATES THAT ARE HARD TO CAUSE ON PURPOSE.
 *
 * `?state=loading|failed|noCompetition` renders that state directly. It exists
 * because the interesting ones are the ones you cannot arrange: a read failure
 * needs the database to break, and "no competition" needs a season that does not
 * exist. Both have to be looked at — they are the states a real player is most
 * likely to meet on a bad day, and the ones nobody screenshots.
 *
 * IT OVERRIDES THE HARNESS, NOT THE SCREEN. `VNextHomeScreen`'s own state
 * machine is untouched and unmocked; this renders the same two presentational
 * components the screen renders, with the same props. So it proves how a state
 * LOOKS and never what decides it.
 */
type ForcedState = 'loading' | 'failed' | 'noCompetition'

function forcedStateFrom(search: string): ForcedState | null {
  const value = new URLSearchParams(search).get('state')
  return value === 'loading' || value === 'failed' || value === 'noCompetition' ? value : null
}

function PreviewBody() {
  const { userId, displayName, loading } = useAuth()
  const forced = forcedStateFrom(window.location.search)
  const [competitionSlug, setCompetitionSlug] = useState('')
  const [seasonSlug, setSeasonSlug] = useState('')
  const [gameCompetitionId, setGameCompetitionId] = useState('')
  const [applied, setApplied] = useState<{
    competitionSlug: string
    seasonSlug: string
    gameCompetitionId: string | null
  } | null>(null)

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`
            and points `<main aria-labelledby>` at it. A harness heading that
            claimed `h1` too would give the document two, which is exactly the
            contract Home's own review checks for — and the harness must not be
            the thing that breaks it. */}
        <h2 className={styles.heading}>vNext Home — real data</h2>
        <p className={styles.note}>
          Development harness. Reads the live database through the same season
          services the Hub uses, and renders the approved Home unchanged. Not a
          product route.
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
            {/* Optional: private leagues hang off the Match Predictor game
                competition, and a player who has not joined it has none. Left
                blank, Home renders its no-league state, which is a real state
                worth being able to look at on purpose. */}
            <span>Game competition id (optional)</span>
            <input
              value={gameCompetitionId}
              onChange={(event) => setGameCompetitionId(event.target.value)}
              placeholder="uuid — leave blank for no private leagues"
            />
          </label>
          <button type="submit">Render Home</button>
        </form>
        <p className={styles.note}>
          {loading
            ? 'Resolving session…'
            : userId
              ? `Signed in as ${displayName ?? userId}`
              : 'No session. Home will render its signed-out state.'}
        </p>
      </header>

      {/*
        The harness frame is a plain full-width container rather than
        `WorkshopCanvas`' device board: this is a real-data review, and the
        browser window IS the container being reviewed. `VNextRoot` is still
        required — every vNext token is declared on its `data-vnext` element and
        nothing renders correctly outside it.
      */}
      <VNextRoot>
        {forced === 'loading' ? (
          <VNextHomeLoading />
        ) : forced === 'failed' ? (
          <VNextHomeNotice
            title="We could not load your matchweek"
            body="The football and your standing are both fine — we just could not read them just now. Trying again usually works."
            onRetry={() => window.location.reload()}
          />
        ) : forced === 'noCompetition' ? (
          <VNextHomeNotice
            title="No competition to show"
            body="Pick a competition and season, and this is where its matchweek will be."
          />
        ) : applied ? (
          <VNextHomeScreen
            userId={userId}
            displayName={displayName}
            authLoading={loading}
            competitionSlug={applied.competitionSlug}
            seasonSlug={applied.seasonSlug}
            gameCompetitionId={applied.gameCompetitionId}
          />
        ) : (
          /* Deliberately renders the loading state before anything is applied,
             so the skeleton is the first thing a reviewer sees and gets looked
             at rather than flashing past. */
          <VNextHomeScreen
            userId={userId}
            displayName={displayName}
            authLoading
            competitionSlug={undefined}
            seasonSlug={undefined}
            gameCompetitionId={null}
          />
        )}
      </VNextRoot>
    </div>
  )
}
