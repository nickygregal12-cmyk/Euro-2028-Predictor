import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Alert, Skeleton } from '../../design-system'
import { ClubIdentity } from '../../design-system/ClubIdentity'
import { createSeasonPlayContextGateway } from '../../services/supabase/seasonPlayContext'
import { fetchSeasonFixtureList } from '../../services/supabase/seasonFixtureList'
import { fetchMyGameLeagues } from '../../services/supabase/gameLeagues'
import { fetchSeasonLeagueStandingsPage } from '../../services/supabase/seasonLeagueStandings'
import { useSeasonGameCompetitionId } from '../hub/useSeasonGameCompetitionId'
import { matchDayKey } from '../../shared/time/kickoff'
import { competitionRoute } from '../../app/weeklyRoutes'
import { presentFixtureList, type FixtureListRow } from './fixtureListModel'
import { presentTvMode, type TvModeInput, type TvPanel } from './tvModeModel'
import { useSeasonPlayContext } from './useSeasonPlayContext'
import { prefersReducedMotion } from '../../app/viewTransitions'
import styles from './SeasonTvMode.module.css'

/**
 * `INNOV-006` — `/competitions/:competitionSlug/:seasonSlug/tv`, the matchday
 * screen for a room.
 *
 * IT IS DESIGNED FOR A TELEVISION, NOT ZOOMED FOR ONE. Type is sized in
 * viewport units so it fills a 1080p screen at five metres; there is no
 * navigation, no app bar, no bottom bar and no control smaller than a hand.
 * It sits OUTSIDE the signed-in shell for exactly that reason — a shell built
 * for a phone in a pocket is the wrong frame for a screen on a wall.
 *
 * IT IS READ-ONLY, AND THAT IS ENFORCED BY WHAT IT LOADS. There is no write
 * gateway imported here, no admin read, no account control and no prediction
 * input. The only interactive elements are Pause and a link back — a shared
 * screen must not be able to change anybody's entry, and the host is very
 * often not the only person who can reach the keyboard.
 *
 * IT NEVER FAKES A LIVE STATE. A fixture is "Live now" only where the fixture
 * list carries a provider score and no confirmed result, and every such panel
 * is labelled provisional. The platform's own result, once confirmed, replaces
 * it in the ordinary way.
 *
 * ROTATION STOPS UNDER REDUCED MOTION, and stays stopped: the preference is
 * checked in code because an auto-advancing panel is motion whether or not any
 * CSS animates it. A player who has asked for less motion gets one panel and
 * the buttons to move between them.
 *
 * NOTHING HERE IS AN AUTHORITY. Fixtures are contract 139's, the table is
 * contract 128's, and this route ranks, scores and settles nothing.
 */

const ROTATION_MS = 12_000

export function SeasonTvModeRoute() {
  const { competitionSlug, seasonSlug } = useParams<{
    competitionSlug: string
    seasonSlug: string
  }>()
  const gateway = useMemo(() => createSeasonPlayContextGateway(), [])
  const state = useSeasonPlayContext(gateway, competitionSlug, seasonSlug)
  const context = state.kind === 'ready' || state.kind === 'season_over' ? state.context : null
  const tournamentId = context?.tournamentId ?? null

  const [fixtures, setFixtures] = useState<readonly FixtureListRow[] | null>(null)
  useEffect(() => {
    if (tournamentId === null) return
    let active = true
    setFixtures(null)
    fetchSeasonFixtureList(tournamentId, {}).then(
      (page) => {
        if (!active) return
        const view = presentFixtureList(page)
        setFixtures(view.days.flatMap((day) => day.rows))
      },
      () => {
        // An empty list is an honest empty screen. A television showing an
        // error message all evening is worse than one showing nothing.
        if (active) setFixtures([])
      },
    )
    return () => {
      active = false
    }
  }, [tournamentId])

  const gameCompetitionId = useSeasonGameCompetitionId(
    competitionSlug,
    seasonSlug,
    'main_predictor',
  )
  const [league, setLeague] = useState<TvModeInput['league']>(null)
  useEffect(() => {
    if (!gameCompetitionId) {
      setLeague(null)
      return
    }
    let active = true
    void (async () => {
      try {
        // The host's first private league. A shared screen shows one table, and
        // choosing between five on a television is not a thing anybody can do
        // from a sofa.
        const leagues = await fetchMyGameLeagues(gameCompetitionId)
        const first = leagues[0]
        if (!first) return
        const page = await fetchSeasonLeagueStandingsPage(first.id)
        if (!active) return
        setLeague({ name: first.name, rows: page.rows, fieldSize: page.totalCount })
      } catch {
        if (active) setLeague(null)
      }
    })()
    return () => {
      active = false
    }
  }, [gameCompetitionId])

  const today = matchDayKey(new Date().toISOString()) ?? ''
  const panels = useMemo(
    () =>
      fixtures === null || context === null
        ? []
        : presentTvMode({
            competitionName: context.competitionName,
            seasonLabel: context.seasonLabel,
            fixtures,
            today,
            league,
          }),
    [fixtures, context, today, league],
  )

  const [index, setIndex] = useState(0)
  const reduced = prefersReducedMotion()
  const [paused, setPaused] = useState(reduced)

  useEffect(() => {
    // Clamp rather than wrap: the panel list can shrink when a match finishes,
    // and an index past the end would blank the screen.
    if (index >= panels.length) setIndex(0)
  }, [index, panels.length])

  useEffect(() => {
    if (paused || panels.length < 2) return
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % panels.length)
    }, ROTATION_MS)
    return () => clearInterval(timer)
  }, [paused, panels.length])

  if (state.kind === 'loading' || fixtures === null) {
    return (
      <div className={styles.screen} aria-busy="true">
        <Skeleton width="60%" height={56} />
        <Skeleton height={300} radius="card" />
      </div>
    )
  }

  if (state.kind === 'unavailable' || context === null) {
    return (
      <div className={styles.screen}>
        <Alert variant="warning" title="This competition could not be opened">
          {state.kind === 'unavailable' ? state.detail : 'This competition season is unavailable.'}
        </Alert>
      </div>
    )
  }

  const panel = panels[index] ?? null
  const back = competitionRoute({
    competitionSlug: competitionSlug ?? '',
    seasonSlug: seasonSlug ?? '',
  })

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <h1 className={styles.competition}>
          {context.competitionName}
          <span className={styles.season}>{context.seasonLabel}</span>
        </h1>
        <div className={styles.controls}>
          {panels.length > 1 ? (
            <button
              type="button"
              className={styles.control}
              onClick={() => setPaused((current) => !current)}
            >
              {paused ? 'Play' : 'Pause'}
            </button>
          ) : null}
          <Link className={styles.control} to={back}>
            Exit
          </Link>
        </div>
      </header>

      {panel === null ? (
        <p className={styles.empty}>No football to show in this competition right now.</p>
      ) : (
        // Announced on change, because the screen advances on its own and a
        // screen-reader user would otherwise never learn that it had.
        <section className={styles.panel} aria-live="polite" aria-atomic="false">
          <h2 className={styles.panelTitle}>{panel.title}</h2>
          <Panel panel={panel} />
        </section>
      )}

      {panels.length > 1 ? (
        <nav className={styles.dots} aria-label="Panels">
          {panels.map((entry, position) => (
            <button
              key={entry.kind}
              type="button"
              className={position === index ? `${styles.dot} ${styles.dotOn}` : styles.dot}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => {
                setIndex(position)
                setPaused(true)
              }}
            >
              <span className={styles.srOnly}>{entry.title}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  )
}

function Panel({ panel }: { panel: TvPanel }) {
  if (panel.kind === 'table') {
    return (
      <>
        <ol className={styles.table}>
          {panel.rows.map((row) => (
            <li className={row.isYou ? `${styles.row} ${styles.rowYou}` : styles.row} key={row.displayName}>
              <span className={styles.position}>{row.position}</span>
              <span className={styles.player}>{row.displayName}</span>
              <span className={styles.points}>{row.points}</span>
            </li>
          ))}
        </ol>
        {panel.fieldSize > panel.rows.length ? (
          // The bound, stated. A top ten beside a league of forty must not read
          // as the whole league.
          <p className={styles.footnote}>
            Top {panel.rows.length} of {panel.fieldSize}.
          </p>
        ) : null}
      </>
    )
  }

  return (
    <>
      <ul className={styles.fixtures}>
        {panel.fixtures.map((fixture) => (
          <li className={styles.fixture} key={fixture.id}>
            <span className={styles.club}>
              <ClubIdentity name={fixture.home.name} tokens={fixture.home.tokens} size="card" />
              <span className={styles.clubName}>{fixture.home.name}</span>
            </span>
            <span className={styles.score}>
              {fixture.score ?? fixture.provisional ?? fixture.kickoff ?? '—'}
            </span>
            <span className={styles.club}>
              <ClubIdentity name={fixture.away.name} tokens={fixture.away.tokens} size="card" />
              <span className={styles.clubName}>{fixture.away.name}</span>
            </span>
          </li>
        ))}
      </ul>
      {panel.kind === 'live' ? (
        // Said on the panel rather than once at the foot of the page: a
        // rotating screen is read in glimpses, and a caveat somebody has to
        // have seen earlier is a caveat nobody sees.
        <p className={styles.footnote}>
          Scores reported by a data provider. Provisional until the platform confirms them.
        </p>
      ) : null}
    </>
  )
}
