import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Skeleton, Workspace } from '../../design-system'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { fetchSeasonFixture } from '../../services/supabase/seasonFixtureList'
import { fetchSeasonLeagueMatchweekPredictions } from '../../services/supabase/seasonLeaguePredictions'
import { fetchSeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovement'
import { fetchMyGameLeagues } from '../../services/supabase/gameLeagues'
import { SeasonFixtureLeagues } from './SeasonFixtureLeagues'
import { useSeasonGameCompetitionId } from '../hub/useSeasonGameCompetitionId'
import { createSeasonMatchPredictorRpcGateway } from '../../services/supabase/seasonMatchPredictor'
import {
  fetchSeasonClubForm,
  fetchSeasonClubHeadToHead,
} from '../../services/supabase/seasonClubForm'
import { fetchSeasonLeaveEligibility } from '../../services/supabase/gameLeaveEligibility'
import { fetchSeasonConsensus } from '../../services/supabase/seasonConsensus'
import { SeasonFixtureConsensus } from './SeasonFixtureConsensus'
import { createSeasonLmsRpcGateway } from '../../services/supabase/seasonLms'
import { presentFixture, type FixtureListRow } from './fixtureListModel'
import { seasonEntryStanding } from './seasonEntryStanding'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { SeasonMatchCentre, type SeasonFootballContext } from './SeasonMatchCentre'
import { seasonBasePath, seasonShellDestinations } from './seasonDestinations'
import {
  competitionMatchPredictorRoute,
  competitionPlayerRoute,
  competitionSectionRoute,
} from '../../app/weeklyRoutes'
import { isNextUi } from '../../app/routeFlags'
import { useSeasonPlayContext } from './useSeasonPlayContext'
import styles from './SeasonMatchPredictorRoute.module.css'

/**
 * `/competitions/:competitionSlug/:seasonSlug/matches/:fixtureId` — one
 * fixture's Match Centre, at an address of its own.
 *
 * WHY THIS EXISTS. The Match Centre shipped as a panel that opens inside the
 * fixture list, and the file recorded the reason: a season fixture had no page
 * because nothing maps a fixture id to its matchweek without the list that
 * already carries it. That made it unlinkable — from a combined Matches view,
 * from a result notification, from a shared link, or from anywhere at all — and
 * the 10 August direction requires an addressable journey.
 *
 * HOW IT LOCATES THE FIXTURE. Contract 148's `get_season_fixture` is addressed
 * by the fixture id, so the URL is genuinely self-contained: one read, no date
 * hint, no window.
 *
 * WHAT THAT REPLACED, AND WHY IT MATTERED. The route used to carry the
 * fixture's day as `?on=`, load a three-week window around it through contract
 * 139 and search the result. A link to a match outside that window — a shared
 * link, an old notification, a fixture postponed into next season's spring —
 * was answered "that match is not in this window", which was honest about the
 * read and useless to the reader. `MIG-UI-11` recorded the gap; contract 148
 * closed it, and the query, the window and that alert are all gone.
 *
 * IT RENDERS THE SAME PANEL AS THE LIST. `SeasonMatchCentre` is unchanged, so
 * the two ways in cannot drift; what this route adds is the resolution, the
 * shell, a heading, and the two things a page has room for that an inline
 * panel did not.
 *
 * THE PAGE IS A COMPOSITION, NOT THE PANEL AT A URL. On a wide screen the
 * football and the player's own side of the match keep the main column, and
 * what everybody predicted sits beside them — contract 130's matchweek
 * consensus, narrowed to this fixture, which is the "Everyone" half of the
 * direction's Match Centre and needed no new authority. Below the wide
 * breakpoint it stacks under, in source order, so a phone reads the result and
 * the prediction first.
 *
 * IT COMPOSES THREE SEPARATE ANSWERS AND KEEPS THEM SEPARATE. **You** — the
 * player's own prediction and points — is the main column. **Your leagues** is
 * contracts 149 and 150: named co-member predictions after this matchweek's own
 * lock, and what the settled matchweek did to each league table. **Everyone**
 * is contract 130's anonymous consensus with its minimum cohort. A named league
 * prediction is not a consensus and the page must never let the two read as one
 * thing.
 */

export function SeasonMatchCentreRoute() {
  const { competitionSlug, seasonSlug, fixtureId } = useParams<{
    competitionSlug: string
    seasonSlug: string
    fixtureId: string
  }>()
  const gateway = useMemo(() => createSeasonPlayContextGateway(), [])
  const state = useSeasonPlayContext(gateway, competitionSlug, seasonSlug)
  const context = state.kind === 'ready' || state.kind === 'season_over' ? state.context : null
  const tournamentId = context?.tournamentId ?? null

  /**
   * The fixture itself, and the round it belongs to.
   *
   * IT DOES NOT WAIT FOR THE SEASON CONTEXT. Contract 148 needs only the
   * fixture id, so the read starts as soon as the route is mounted rather than
   * after a second request has told it which season it is in.
   */
  const [fixture, setFixture] = useState<FixtureListRow | null | 'missing'>(null)
  const [roundId, setRoundId] = useState<string | null>(null)
  useEffect(() => {
    if (!fixtureId) return
    let active = true
    setFixture(null)
    setRoundId(null)
    fetchSeasonFixture(fixtureId)
      .then((answer) => {
        if (!active) return
        if (!answer.fixture) {
          setFixture('missing')
          return
        }
        setFixture(presentFixture(answer.fixture).row)
        setRoundId(answer.fixture.round.id)
      })
      .catch(() => {
        // The server refuses a fixture that does not exist and one that belongs
        // to the tournament shape. Both are "we cannot open this match", which
        // is a different sentence from the window message this replaced.
        if (active) setFixture('missing')
      })
    return () => {
      active = false
    }
  }, [fixtureId])

  /**
   * The caller's private leagues in this season's Match Predictor, from the
   * membership the shell already read — no extra request, and a player who has
   * joined no game has no leagues to ask about.
   */
  const gameCompetitionId = useSeasonGameCompetitionId(
    competitionSlug,
    seasonSlug,
    'main_predictor',
  )
  const [leagues, setLeagues] = useState<readonly { id: string; name: string }[]>([])
  useEffect(() => {
    if (!gameCompetitionId) {
      setLeagues([])
      return
    }
    let active = true
    fetchMyGameLeagues(gameCompetitionId)
      .then((rows) => {
        if (active) setLeagues(rows.map((row) => ({ id: row.id, name: row.name })))
      })
      .catch(() => {
        // A league list that could not be read renders no league section rather
        // than an error over a section the player may not even use.
        if (active) setLeagues([])
      })
    return () => {
      active = false
    }
  }, [gameCompetitionId])

  // The player's own side of the match, and the football beside it. Both are
  // the Matches route's own gateways, unchanged: a second decoder over the card
  // would be a second opinion about the player's entry.
  const readCard = useMemo(() => {
    if (!context || tournamentId === null) return null
    const cards = createSeasonMatchPredictorRpcGateway({
      tournamentId,
      competitionName: context.competitionName,
      seasonLabel: context.seasonLabel,
      timeZone: context.timeZone,
      now: () => new Date(),
    })
    return (matchweek: number) => cards.load(matchweek)
  }, [context, tournamentId])

  const [football, setFootball] = useState<SeasonFootballContext | undefined>(undefined)
  useEffect(() => {
    if (tournamentId === null) return
    let active = true
    setFootball(undefined)
    void (async () => {
      // Each read fails alone: the football is the same for everybody, the
      // entry is the caller's, and neither may take the page down.
      const [form, lms, eligibility] = await Promise.all([
        fetchSeasonClubForm(tournamentId).then(
          (table) => table.clubs,
          () => null,
        ),
        createSeasonLmsRpcGateway({ tournamentId }).load().then(
          (round) => round,
          () => null,
        ),
        fetchSeasonLeaveEligibility(tournamentId).then(
          (answer) => answer.games,
          () => null,
        ),
      ])
      if (!active) return
      const byName = new Map((form ?? []).map((club) => [club.name, club]))
      setFootball({
        formFor: form === null ? undefined : (name: string) => byName.get(name) ?? null,
        headToHead: (teamId: string, opponentId: string) =>
          fetchSeasonClubHeadToHead(tournamentId, teamId, opponentId),
        lmsRound: lms,
        entryStanding: seasonEntryStanding(eligibility),
      })
    })()
    return () => {
      active = false
    }
  }, [tournamentId])

  /**
   * Contract 130's consensus, for the matchweek this fixture belongs to. The
   * fixture row carries its round, so no extra resolution is needed; the read
   * enforces the lock itself, and the panel renders nothing until it passes.
   */
  const consensusLoad = useMemo(() => {
    if (tournamentId === null) return null
    return (matchweek: number) => fetchSeasonConsensus(tournamentId, matchweek)
  }, [tournamentId])

  /**
   * A co-member's own season profile (contract 151). The server refuses a
   * caller who shares no private league with them, so this link is only ever
   * offered where the boundary already holds — from inside a league section.
   */
  const playerHref = useMemo(() => {
    const ref = { competitionSlug: competitionSlug ?? '', seasonSlug: seasonSlug ?? '' }
    return (playerId: string) => competitionPlayerRoute(ref, playerId)
  }, [competitionSlug, seasonSlug])

  const predictHref = useMemo(() => {
    if (!isNextUi('seasonMatchPredictor')) return undefined
    const ref = { competitionSlug: competitionSlug ?? '', seasonSlug: seasonSlug ?? '' }
    return (matchweek: number) => competitionMatchPredictorRoute(ref, matchweek)
  }, [competitionSlug, seasonSlug])

  if (state.kind === 'loading') {
    return (
      <div className={styles.page} aria-busy="true" aria-live="polite">
        <span className={styles.srOnly}>Loading this match</span>
        <Skeleton width="60%" height={28} />
        <Skeleton height={220} radius="card" />
      </div>
    )
  }

  if (state.kind === 'unavailable' || context === null) {
    return (
      <div className={styles.page}>
        <Alert variant="warning" title="This match could not be opened">
          {state.kind === 'unavailable' ? state.detail : 'This competition season is unavailable.'}
        </Alert>
      </div>
    )
  }

  const base = seasonBasePath(competitionSlug ?? '', seasonSlug ?? '')
  const matchesHref = competitionSectionRoute(
    { competitionSlug: competitionSlug ?? '', seasonSlug: seasonSlug ?? '' },
    'matches',
  )
  // The long form, because this page IS the fixture and nothing above it
  // carries the date.
  const heading =
    fixture && fixture !== 'missing'
      ? `${fixture.home.name} v ${fixture.away.name}`
      : 'Match Centre'

  return (
    <SeasonCompetitionShell
      competitionName={context.competitionName}
      seasonLabel={context.seasonLabel}
      statusStrip={[heading]}
      active="matches"
      destinations={seasonShellDestinations(base)}
      // The page composes its own two columns, so the shell stops capping the
      // content at a reading column and lets it.
      width="full"
    >
      {fixture === null ? (
        <div aria-busy="true">
          <Skeleton width="70%" height={28} />
          <Skeleton height={260} radius="card" />
        </div>
      ) : fixture === 'missing' ? (
        <Alert variant="warning" title="This match could not be opened">
          It may have been removed from the calendar, or it belongs to a different competition.
          The competition&rsquo;s own fixture list is the place to find it.
          <div style={{ marginTop: 10 }}>
            <Link to={matchesHref}>Open the fixture list</Link>
          </div>
        </Alert>
      ) : (
        <Workspace
          asideLabel="What this match means for you"
          aside={
            <>
              {/* Your leagues, then Everyone. Named and private above
                  anonymous and platform-wide: the people a player actually
                  plays with are the ones they came to compare themselves
                  against, and the two must never read as one section. */}
              <SeasonFixtureLeagues
                fixtureId={fixture.id}
                competitionRoundId={roundId}
                leagues={leagues}
                loadPredictions={fetchSeasonLeagueMatchweekPredictions}
                loadMovement={fetchSeasonLeagueMovement}
                playerHref={playerHref}
              />
              {consensusLoad ? (
                <SeasonFixtureConsensus
                  matchweek={fixture.round.ordinal}
                  fixtureId={fixture.id}
                  load={consensusLoad}
                />
              ) : null}
            </>
          }
        >
          <h1 className={styles.srOnly}>{fixture.accessibleSummary}</h1>
          <SeasonMatchCentre
            fixture={fixture}
            read={readCard as NonNullable<typeof readCard>}
            football={football}
            predictHref={predictHref}
          />
        </Workspace>
      )}
    </SeasonCompetitionShell>
  )
}
