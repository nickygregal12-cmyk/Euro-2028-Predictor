import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Alert, Skeleton } from '../../design-system'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { fetchSeasonFixtureList } from '../../services/supabase/seasonFixtureList'
import { createSeasonMatchPredictorRpcGateway } from '../../services/supabase/seasonMatchPredictor'
import {
  fetchSeasonClubForm,
  fetchSeasonClubHeadToHead,
} from '../../services/supabase/seasonClubForm'
import { fetchSeasonLeaveEligibility } from '../../services/supabase/gameLeaveEligibility'
import { createSeasonLmsRpcGateway } from '../../services/supabase/seasonLms'
import { presentFixtureList, type FixtureListRow } from './fixtureListModel'
import { seasonEntryStanding } from './seasonEntryStanding'
import { SeasonCompetitionShell } from './SeasonCompetitionShell'
import { SeasonMatchCentre, type SeasonFootballContext } from './SeasonMatchCentre'
import { seasonBasePath, seasonShellDestinations } from './seasonDestinations'
import { competitionMatchPredictorRoute, competitionSectionRoute } from '../../app/weeklyRoutes'
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
 * HOW IT LOCATES THE FIXTURE WITHOUT A READ ADDRESSED BY ID. Contract 139's
 * read is windowed by date and caps at 120 days, so the route loads the window
 * around the day the link carried (`?on=`) and finds the fixture in it. Every
 * link the product generates carries that day because every surface that shows
 * a fixture already knows it. With no hint it falls back to the server's own
 * default window.
 *
 * IT IS HONEST WHEN IT CANNOT FIND IT. A fixture outside the window it loaded
 * is reported as out of range, with a way to the competition's fixture list —
 * never as "no such match", which would be false, and never as a blank panel.
 * A read addressed by fixture id would remove the guesswork entirely and is
 * recorded as `MIG-UI-11`.
 *
 * IT RENDERS THE SAME PANEL AS THE LIST. `SeasonMatchCentre` is unchanged, so
 * the two ways in cannot drift; what this route adds is the resolution, the
 * shell and a heading, because a page needs to say what it is before its
 * content loads.
 */

/** A window wide enough to hold the day, inside the server's 120-day cap. */
const WINDOW_DAYS = 21

function windowAround(day: string | null): { from?: string; to?: string } {
  if (!day) return {}
  const at = new Date(`${day}T12:00:00Z`)
  if (Number.isNaN(at.getTime())) return {}
  const from = new Date(at)
  from.setUTCDate(from.getUTCDate() - WINDOW_DAYS)
  const to = new Date(at)
  to.setUTCDate(to.getUTCDate() + WINDOW_DAYS)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function SeasonMatchCentreRoute() {
  const { competitionSlug, seasonSlug, fixtureId } = useParams<{
    competitionSlug: string
    seasonSlug: string
    fixtureId: string
  }>()
  const [search] = useSearchParams()
  const on = search.get('on')

  const gateway = useMemo(() => createSeasonPlayContextGateway(), [])
  const state = useSeasonPlayContext(gateway, competitionSlug, seasonSlug)
  const context = state.kind === 'ready' || state.kind === 'season_over' ? state.context : null
  const tournamentId = context?.tournamentId ?? null

  const [fixture, setFixture] = useState<FixtureListRow | null | 'missing'>(null)
  useEffect(() => {
    if (tournamentId === null || !fixtureId) return
    let active = true
    setFixture(null)
    fetchSeasonFixtureList(tournamentId, windowAround(on))
      .then((page) => {
        if (!active) return
        const view = presentFixtureList(page)
        const found = view.days.flatMap((day) => day.rows).find((row) => row.id === fixtureId)
        setFixture(found ?? 'missing')
      })
      .catch(() => {
        if (active) setFixture('missing')
      })
    return () => {
      active = false
    }
  }, [tournamentId, fixtureId, on])

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
    >
      {fixture === null ? (
        <div aria-busy="true">
          <Skeleton width="70%" height={28} />
          <Skeleton height={260} radius="card" />
        </div>
      ) : fixture === 'missing' ? (
        <Alert variant="warning" title="That match is not in this window">
          A season's fixtures are read a few weeks at a time, so a match far from the linked date
          cannot be opened directly yet. It is still in the competition's fixture list.
          <div style={{ marginTop: 10 }}>
            <Link to={matchesHref}>Open the fixture list</Link>
          </div>
        </Alert>
      ) : (
        <>
          <h1 className={styles.srOnly}>{fixture.accessibleSummary}</h1>
          <SeasonMatchCentre
            fixture={fixture}
            read={readCard as NonNullable<typeof readCard>}
            football={football}
            predictHref={predictHref}
          />
        </>
      )}
    </SeasonCompetitionShell>
  )
}
