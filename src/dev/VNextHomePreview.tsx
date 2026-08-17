import { useState } from 'react'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextHomeScreen } from '../vnext/integration/home/VNextHomeScreen'
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

function PreviewBody() {
  const { userId, displayName, loading } = useAuth()
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
        <h1 className={styles.heading}>vNext Home — real data</h1>
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
        {applied ? (
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
