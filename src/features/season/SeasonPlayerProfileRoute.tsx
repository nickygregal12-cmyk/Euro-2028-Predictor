import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Skeleton } from '../../design-system'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import {
  fetchSeasonPlayerProfile,
  type SeasonPlayerProfile,
} from '../../services/supabase/seasonPlayerProfile'
import { competitionSectionRoute } from '../../app/weeklyRoutes'
import { ordinal } from '../league/ordinal'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { seasonBasePath, seasonShellDestinations } from './seasonDestinations'
import { useSeasonPlayContext } from './useSeasonPlayContext'
import styles from './SeasonPlayerProfileRoute.module.css'

/**
 * `/competitions/:competitionSlug/:seasonSlug/players/:playerId` — one player's
 * season, and what they predicted (contract 151, closing `MIG-UI-02`).
 *
 * WHY IT IS COMPETITION-SCOPED. Points, rank, matchweeks played and prediction
 * history are all facts about a player IN a season. A platform-level
 * `/player/:id` would have to choose a season to show or invent a combined
 * total no authority computes, and ADR 0012 ranks a season on that season's
 * points alone. The platform profile at `/profile` holds identity and links
 * here; this page holds the season.
 *
 * THE DISCLOSURE BOUNDARY IS THE SERVER'S, IN FULL. Contract 151 refuses any
 * caller who is neither the player nor a co-member of a private league on this
 * season — sharing a competition is not enough, because a season may have fifty
 * thousand entrants and none of them agreed to be looked up. This page renders
 * that refusal as what it is rather than as an empty profile, and it does not
 * pre-check it: a browser deciding who may be looked up would be a second
 * boundary that can disagree with the first.
 *
 * THERE IS NO DIRECTORY, AND THIS ROUTE IS NOT ONE. It answers about the one
 * player named in the URL and cannot enumerate, search or rank anybody. Every
 * link into it comes from a surface that already names the player — a private
 * league's table or matchweek, the Match Centre's league section, or the
 * player's own profile.
 *
 * PREDICTION HISTORY IS THE SERVER'S TO WITHHOLD. A matchweek appears only once
 * its own lock has passed, which is contract 149's boundary reused; the player's
 * own profile is ungated because those are their own picks. Nothing here filters
 * by time, because a filter a browser applies is one a browser can skip.
 *
 * POINTS ARE NEVER RECOMPUTED. Season points, rank, field size and matchweek
 * points all come from the banked authorities the season and the leagues use.
 * The exact-score and correct-outcome counts are the read's own, derived over
 * settled matchweeks; this page prints them and multiplies nothing.
 */
export function SeasonPlayerProfileRoute() {
  const { competitionSlug, seasonSlug, playerId } = useParams<{
    competitionSlug: string
    seasonSlug: string
    playerId: string
  }>()

  const gateway = useMemo(() => createSeasonPlayContextGateway(), [])
  const state = useSeasonPlayContext(gateway, competitionSlug, seasonSlug)
  const context = state.kind === 'ready' || state.kind === 'season_over' ? state.context : null
  const tournamentId = context?.tournamentId ?? null

  const [profile, setProfile] = useState<
    { kind: 'loading' } | { kind: 'refused' } | { kind: 'failed' } | { kind: 'ready'; profile: SeasonPlayerProfile }
  >({ kind: 'loading' })

  useEffect(() => {
    if (tournamentId === null || !playerId) return
    let active = true
    setProfile({ kind: 'loading' })
    fetchSeasonPlayerProfile(tournamentId, playerId)
      .then((answer) => {
        if (active) setProfile({ kind: 'ready', profile: answer })
      })
      .catch((error: unknown) => {
        if (!active) return
        // The privacy refusal and a failed read are different sentences. The
        // server raises `insufficient_privilege` for the boundary, and the page
        // must not flatten that into "something went wrong".
        setProfile({ kind: refusedByPrivacy(error) ? 'refused' : 'failed' })
      })
    return () => {
      active = false
    }
  }, [tournamentId, playerId])

  if (state.kind === 'loading') {
    return (
      <div aria-busy="true" aria-live="polite">
        <span className={styles.srOnly}>Loading this player&rsquo;s season</span>
        <Skeleton width="50%" height={28} />
        <Skeleton height={200} radius="card" />
      </div>
    )
  }

  if (state.kind === 'unavailable' || context === null) {
    return (
      <Alert variant="warning" title="This player&rsquo;s season could not be opened">
        {state.kind === 'unavailable' ? state.detail : 'This competition season is unavailable.'}
      </Alert>
    )
  }

  const base = seasonBasePath(competitionSlug ?? '', seasonSlug ?? '')
  const leaguesHref = competitionSectionRoute(
    { competitionSlug: competitionSlug ?? '', seasonSlug: seasonSlug ?? '' },
    'leagues',
  )

  const heading =
    profile.kind === 'ready' ? profile.profile.player.displayName : 'Player'

  return (
    <SeasonCompetitionShell
      competitionName={context.competitionName}
      seasonLabel={context.seasonLabel}
      statusStrip={[heading]}
      active="overview"
      destinations={seasonShellDestinations(base)}
    >
      {profile.kind === 'loading' ? (
        <div aria-busy="true">
          <Skeleton width="45%" height={28} />
          <Skeleton height={200} radius="card" />
        </div>
      ) : profile.kind === 'refused' ? (
        <Alert variant="warning" title="You cannot see this player&rsquo;s season">
          A player&rsquo;s season is visible to the people they share a private league with.
          Playing in the same competition is not enough.
          <div style={{ marginTop: 10 }}>
            <Link to={leaguesHref}>Your leagues in this competition</Link>
          </div>
        </Alert>
      ) : profile.kind === 'failed' ? (
        <Alert variant="warning" title="This player&rsquo;s season could not be loaded">
          Nothing is hidden here — the read failed. Try again shortly.
        </Alert>
      ) : (
        <PlayerSeason profile={profile.profile} />
      )}
    </SeasonCompetitionShell>
  )
}

function PlayerSeason({ profile }: { profile: SeasonPlayerProfile }) {
  const { player, season, accuracy, jokers, history } = profile

  if (!profile.entered) {
    return (
      <div className={styles.identity}>
        <h1 className={styles.name}>{player.displayName}</h1>
        {/* A co-member who never entered is a real answer, not an error. */}
        <p className={styles.note}>
          {player.isSelf
            ? 'You have not entered this competition season yet.'
            : 'This player is in your league but has not entered this competition season.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className={styles.identity}>
        <h1 className={styles.name}>{player.displayName}</h1>
        {player.isSelf ? <span className={styles.you}>This is you</span> : null}
      </div>

      <ul className={styles.stats}>
        {season ? (
          <>
            <li className={styles.stat}>
              <span className={styles.statValue}>{season.points}</span>
              <span className={styles.statLabel}>Season points</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{ordinal(season.rank)}</span>
              {/* Never a bare rank: a position without a field size says
                  nothing about how it was earned. */}
              <span className={styles.statLabel}>of {season.fieldSize} players</span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{season.matchweeksPlayed}</span>
              <span className={styles.statLabel}>Matchweeks played</span>
            </li>
          </>
        ) : null}
        {accuracy ? (
          <>
            <li className={styles.stat}>
              <span className={styles.statValue}>{accuracy.exactScores}</span>
              <span className={styles.statLabel}>Exact scores</span>
              <span className={styles.statNote}>
                of {accuracy.fixturesPredicted} settled predictions
              </span>
            </li>
            <li className={styles.stat}>
              <span className={styles.statValue}>{accuracy.correctOutcomes}</span>
              <span className={styles.statLabel}>Correct results</span>
              <span className={styles.statNote}>
                of {accuracy.fixturesPredicted} settled predictions
              </span>
            </li>
          </>
        ) : null}
        {jokers && jokers.played > 0 ? (
          <li className={styles.stat}>
            <span className={styles.statValue}>{jokers.played}</span>
            <span className={styles.statLabel}>Jokers played</span>
            <span className={styles.statNote}>
              {jokers.pointsFromJokerMatchweeks} pts in those matchweeks
            </span>
          </li>
        ) : null}
      </ul>

      <h2 className={styles.sectionTitle}>Matchweek history</h2>

      {history.length === 0 ? (
        <p className={styles.note}>
          {player.isSelf
            ? 'Nothing to show yet — your first predicted matchweek appears here.'
            : 'No matchweek of theirs has locked yet.'}
        </p>
      ) : (
        <ul className={styles.history}>
          {history.map((matchweek) => (
            <li className={styles.matchweek} key={matchweek.matchweekId}>
              <div className={styles.matchweekTop}>
                <span className={styles.matchweekLabel}>{matchweek.label}</span>
                {matchweek.points === null ? (
                  // Absent points and zero points are different answers.
                  <span className={styles.matchweekPending}>Not settled</span>
                ) : (
                  <span className={styles.matchweekPoints}>{matchweek.points} pts</span>
                )}
              </div>
              {matchweek.jokerPlayed ? <span className={styles.joker}>Joker</span> : null}
              <ul className={styles.picks}>
                {Object.entries(matchweek.predictions).map(([fixtureId, prediction]) => (
                  <li className={styles.pick} key={fixtureId}>
                    {prediction.home} - {prediction.away}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.note}>
        Predictions appear once that matchweek has locked at its first kickoff. Your own are
        always visible to you.
      </p>
    </>
  )
}

/**
 * The privacy refusal, told apart from every other failure.
 *
 * Matched on the server's own code and message rather than on a status: the
 * function raises `insufficient_privilege` for the co-membership boundary, and
 * PostgREST carries that through as the error's `code`.
 */
function refusedByPrivacy(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const row = error as { code?: unknown; message?: unknown }
  if (row.code === '42501' || row.code === 'insufficient_privilege') return true
  return typeof row.message === 'string' && row.message.includes('do not share a private league')
}
