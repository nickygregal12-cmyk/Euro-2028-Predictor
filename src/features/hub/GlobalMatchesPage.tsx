import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, EmptyState, Skeleton } from '../../design-system'
import { ClubIdentity } from '../../design-system/ClubIdentity'
import { fetchSeasonFixtureList } from '../../services/supabase/seasonFixtureList'
import { presentFixtureList } from '../season/fixtureListModel'
import { matchDayKey } from '../../shared/time/kickoff'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { competitionMatchCentreRoute, weeklyRoutes } from '../../app/weeklyRoutes'
import {
  presentCombinedFixtures,
  type CombinedFixtureSource,
  type CombinedFixtureView,
} from './combinedFixturesModel'
import styles from './GlobalMatchesPage.module.css'
import s from '../shared.module.css'

/**
 * `/matches` — one football calendar across the competitions the player plays
 * in.
 *
 * WHAT IT REPLACES. This route asked which competition first. Football does not
 * happen one competition at a time, and a Saturday with fixtures in two
 * competitions was two visits to see.
 *
 * IT DEFAULTS TO THE PLAYER'S OWN COMPETITIONS, never the platform catalogue.
 * That is the scalability requirement: on a twenty-competition platform this
 * page is three competitions wide for a player relevant to three, and the rest
 * are reachable from Explore rather than poured into the default view.
 *
 * ONE READ PER COMPETITION, SETTLED INDEPENDENTLY. A competition that fails is
 * named and the others still render — a fixture list that silently omits a
 * competition is indistinguishable from one with no matches on.
 *
 * THE ROWS ARE THE MATCHES SECTION'S OWN. `presentFixtureList` produces them,
 * so the provisional-is-never-a-result rule, the server's `played`, the
 * viewer's timezone and the matchweek labelling are all honoured by
 * construction rather than by a second implementation.
 */

/**
 * The route reference for a competition the player plays in.
 *
 * Returns null rather than guessing when the key matches nothing loaded: a row
 * with no reachable competition is rendered as a row, not as a link to a URL
 * assembled out of empty slugs.
 */
function competitionRefFor(
  entries: readonly { competition: { seasonRowName: string; competitionSlug: string; seasonSlug: string } }[],
  key: string,
): { competitionSlug: string; seasonSlug: string } | null {
  const found = entries.find((entry) => entry.competition.seasonRowName === key)
  if (!found) return null
  return {
    competitionSlug: found.competition.competitionSlug,
    seasonSlug: found.competition.seasonSlug,
  }
}

const VIEWS: readonly { id: CombinedFixtureView; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'results', label: 'Results' },
]

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; sources: CombinedFixtureSource[]; unreadable: string[] }

export function GlobalMatchesPage() {
  const { status: membership, player, reload } = usePlayerCompetitions()
  const [load, setLoad] = useState<LoadState>({ status: 'loading' })
  const [view, setView] = useState<CombinedFixtureView>('upcoming')
  const [filter, setFilter] = useState<string>('all')

  const key = (player?.mine ?? []).map((entry) => entry.competition.seasonRowName).join('|')

  useEffect(() => {
    if (player === null) return
    let active = true
    setLoad({ status: 'loading' })

    void (async () => {
      const targets = player.mine.filter((entry) => entry.tournamentId !== null)
      const results = await Promise.allSettled(
        targets.map(async (entry) => ({
          competitionKey: entry.competition.seasonRowName,
          competitionName: entry.competition.name,
          // The server's own default window — the last week and the next
          // fortnight — for the same reason the competition Matches section
          // uses it: the browser holds no opinion about where "now" starts.
          view: presentFixtureList(await fetchSeasonFixtureList(entry.tournamentId as string, {})),
        })),
      )
      if (!active) return

      const sources: CombinedFixtureSource[] = []
      const unreadable: string[] = []
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') sources.push(result.value)
        else unreadable.push(targets[index]?.competition.name ?? 'A competition')
      })
      setLoad({ status: 'ready', sources, unreadable })
    })()

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, player === null])

  // The viewer's own today, in the same zone the day keys were resolved in, so
  // "Today" cannot select a day the headings call something else.
  const today = matchDayKey(new Date().toISOString()) ?? ''

  const combined = useMemo(
    () =>
      load.status === 'ready'
        ? presentCombinedFixtures(load.sources, load.unreadable, view, today, filter)
        : null,
    [load, view, today, filter],
  )

  if (membership === 'failed') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Matches</h1>
        <Alert variant="error" title="We could not load your competitions">
          Nothing is claimed either way.
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  }

  if (membership === 'loading' || !combined) {
    return (
      <div className={s.page} aria-busy="true">
        <h1 className={s.title}>Matches</h1>
        <Skeleton width="60%" height={32} />
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={56} />
      </div>
    )
  }

  if (player !== null && player.empty) {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Matches</h1>
        <EmptyState
          title="No football to show yet"
          description="Matches here follow the competitions you play in. Join a competition and its fixtures appear."
          action={
            <Link className={styles.link} to={weeklyRoutes.competitions}>
              Find a competition
            </Link>
          }
        />
      </div>
    )
  }

  const filters = player?.mine ?? []

  return (
    <div className={s.page}>
      <h1 className={s.title}>Matches</h1>

      <div className={styles.views} role="group" aria-label="Which matches">
        {VIEWS.map((option) => {
          const selected = option.id === view
          return (
            <button
              key={option.id}
              type="button"
              className={`${styles.view} ${selected ? styles.viewOn : ''}`}
              aria-pressed={selected}
              onClick={() => setView(option.id)}
            >
              {option.label} <span className={styles.count}>{combined.counts[option.id]}</span>
            </button>
          )
        })}
      </div>

      {/* Offered only where there is more than one competition to separate. A
          filter over a single competition is furniture. */}
      {filters.length > 1 ? (
        <div className={styles.filters} role="group" aria-label="Filter by competition">
          <button
            type="button"
            className={`${styles.filter} ${filter === 'all' ? styles.filterOn : ''}`}
            aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}
          >
            All mine
          </button>
          {filters.map((entry) => {
            const selected = filter === entry.competition.seasonRowName
            return (
              <button
                key={entry.competition.seasonRowName}
                type="button"
                className={`${styles.filter} ${selected ? styles.filterOn : ''}`}
                aria-pressed={selected}
                onClick={() => setFilter(entry.competition.seasonRowName)}
              >
                {entry.competition.name}
              </button>
            )
          })}
        </div>
      ) : null}

      {combined.unreadable.length > 0 ? (
        <Alert variant="warning" title="Some competitions could not be read">
          {combined.unreadable.join(', ')} could not be loaded just now, so their fixtures are
          missing from this list.
        </Alert>
      ) : null}

      {combined.empty ? (
        <p className={styles.none}>
          {view === 'today'
            ? 'No matches today in the competitions you play in.'
            : view === 'results'
              ? 'No results yet. A score appears once the result is confirmed.'
              : 'No upcoming matches in this window.'}
        </p>
      ) : (
        combined.days.map((day) => (
          <section className={styles.day} key={day.key} aria-labelledby={`day-${day.key}`}>
            {/* The date is the heading, so a row prints only its kick-off time
                — the direction's rule about duplicated dates. */}
            <h2 className={styles.dayTitle} id={`day-${day.key}`}>
              {day.label}
            </h2>
            <ul className={styles.list}>
              {day.rows.map((row) => {
                const ref = competitionRefFor(filters, row.competitionKey)
                const body = (
                  <>
                    <span className={styles.srOnly}>
                      {row.competitionName}. {row.accessibleSummary}
                    </span>
                    <span className={styles.competition} aria-hidden="true">
                      {row.competitionName}
                    </span>
                    <span className={styles.fixture} aria-hidden="true">
                      <span className={styles.home}>
                        <span className={styles.clubName}>{row.home.name}</span>
                        <ClubIdentity name={row.home.name} tokens={row.home.tokens} size="table" />
                      </span>
                      <span className={row.played ? styles.score : styles.kickoff}>
                        {row.score ?? row.provisional ?? row.kickoff ?? '—'}
                      </span>
                      <span className={styles.away}>
                        <ClubIdentity name={row.away.name} tokens={row.away.tokens} size="table" />
                        <span className={styles.clubName}>{row.away.name}</span>
                      </span>
                    </span>
                    {row.provisional ? (
                      <span className={styles.provisional} aria-hidden="true">
                        Provisional
                      </span>
                    ) : null}
                  </>
                )
                return (
                  <li className={styles.matchItem} key={`${row.competitionKey}-${row.id}`}>
                    {/* Into that fixture's own Match Centre, addressed
                        directly, so a combined list is a way IN to a match
                        rather than a read-only summary. */}
                    {ref ? (
                      <Link className={styles.match} to={competitionMatchCentreRoute(ref, row.id)}>
                        {body}
                      </Link>
                    ) : (
                      <div className={styles.match}>{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
