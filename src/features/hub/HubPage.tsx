import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Alert, Button, EmptyState, Skeleton, Workspace } from '../../design-system'
import { ClubIdentity } from '../../design-system/ClubIdentity'
import { fetchSeasonFixtureList } from '../../services/supabase/seasonFixtureList'
import { presentFixtureList } from '../season/fixtureListModel'
import { formatDeadline, matchDayKey } from '../../shared/time/kickoff'
import { usePlayerCompetitions } from '../../app/providers/PlayerCompetitionsProvider'
import { useAuth } from '../auth/AuthProvider'
import { competitionMatchCentreRoute, weeklyRoutes } from '../../app/weeklyRoutes'
import { competitionPath } from './competitionCatalogue'
import { useGlobalPlayInbox } from './useGlobalPlayInbox'
import {
  presentCombinedFixtures,
  type CombinedFixtureRow,
  type CombinedFixtureSource,
} from './combinedFixturesModel'
import { presentSinceLastVisit } from './sinceLastVisitModel'
import { BriefingPanel } from './BriefingPanel'
import type { BriefingInput, BriefingStanding } from './briefingModel'
import { useMatchweekRecap } from './useMatchweekRecap'
import { useRivalWatch } from './useRivalWatch'
import { RivalWatchCard } from './RivalWatchCard'
import { ordinal } from '../league/ordinal'
import { readLastVisit, writeLastVisit } from './lastVisit'
import type { InboxAction } from './playInboxModel'
import s from '../shared.module.css'
import h from './hub.module.css'

/**
 * `/` — the signed-in Hub, as a personalised dashboard.
 *
 * WHAT IT REPLACES. The Hub was a competition catalogue: "Choose your
 * competition", then My competitions and Discover, each a large card listing
 * every game whether or not the player was in it. The 10 August authority is
 * explicit that Home is not a catalogue, that discovery must not visually
 * compete with outstanding actions, and that on a platform of many competitions
 * Home defaults to the player's own. The old page did the opposite of all three
 * — with twenty competitions it would have been twenty large cards, seventeen
 * of them advertising.
 *
 * THE ORDER IS THE AUTHORITY'S. Next required action, then live football, then
 * what changed since the last visit, then compact competition summaries, then
 * discovery. On desktop the football and the competitions move into the
 * contextual panel so the action keeps the main column to itself.
 *
 * WHAT IT NOW SHOWS, AND WHERE IT COMES FROM. The Matchweek Recap is real:
 * contract 151 supplies the player's banked matchweek points, season total,
 * rank of field size and exact/correct counts, and contract 150 supplies
 * movement inside a private league. Nothing is approximated — a dashboard that
 * guessed at a player's rank would be wrong in the one place a player checks
 * first — and a competition with nothing settled contributes no card.
 *
 * ITS BOUNDS ARE STATED ON THE SURFACE. A player relevant to twenty
 * competitions must not make the Hub issue twenty requests, so the recap covers
 * the first three and fetches league movement for the most relevant one. The
 * section says how many it did not summarise; a cap nobody can see reads as
 * "we covered everything".
 *
 * WHAT IS STILL ABSENT. Rival Watch pinning needs `MIG-UI-09` (optional), and
 * permanent Season Wrapped needs `MIG-UI-08`'s immutable archive. Neither is
 * approximated here.
 */

function PrimaryAction({ action }: { action: InboxAction }) {
  const when = formatDeadline(action.locksAt)
  const body = (
    <>
      <span className={h.primaryWhere}>
        {action.competitionName} · {action.gameName}
      </span>
      <span className={h.primaryTitle}>{action.title}</span>
      {when ? <span className={h.primaryWhen}>Locks {when}</span> : null}
    </>
  )
  return action.href ? (
    <Link className={h.primary} to={action.href}>
      {body}
    </Link>
  ) : (
    <div className={`${h.primary} ${h.primaryInert}`}>{body}</div>
  )
}

function FixtureRow({ row, href }: { row: CombinedFixtureRow; href: string | null }) {
  const body = (
    <>
      <span className={h.srOnly}>
        {row.competitionName}. {row.accessibleSummary}
      </span>
      <span className={h.fixtureWhere} aria-hidden="true">
        {row.competitionName}
      </span>
      <span className={h.fixtureLine} aria-hidden="true">
        <ClubIdentity name={row.home.name} tokens={row.home.tokens} size="table" />
        <span className={h.fixtureScore}>
          {row.score ?? row.provisional ?? row.kickoff ?? '—'}
        </span>
        <ClubIdentity name={row.away.name} tokens={row.away.tokens} size="table" />
      </span>
      <span className={h.fixtureClubs} aria-hidden="true">
        {row.home.name} v {row.away.name}
      </span>
    </>
  )
  return href ? (
    // INNOV-024: a fixture card opening into its Match Centre is one of the four
    // transitions the direction names. Opt-in per link, never page-wide, and
    // suppressed entirely under prefers-reduced-motion.
    <Link className={h.fixture} to={href} viewTransition>
      {body}
    </Link>
  ) : (
    <div className={h.fixture}>{body}</div>
  )
}

export function HubPage() {
  const { status: membership, player, preferences, reload } = usePlayerCompetitions()
  const { userId } = useAuth()
  const { inbox } = useGlobalPlayInbox(player)

  // Read once on mount. The marker is NOT advanced here, and that is a fix
  // rather than an omission: it used to advance on mount, so a Hub whose
  // fixture reads then failed silently consumed a period the player never
  // actually saw — the next visit measured "since" from a moment nothing was
  // shown at. It now advances only once the football this section is built from
  // has resolved, below.
  const [lastVisit] = useState(readLastVisit)

  const [sources, setSources] = useState<CombinedFixtureSource[] | null>(null)
  const key = (player?.mine ?? []).map((entry) => entry.competition.seasonRowName).join('|')
  useEffect(() => {
    if (player === null) return
    if (player.mine.length === 0) {
      setSources([])
      return
    }
    let active = true
    setSources(null)
    void (async () => {
      const targets = player.mine.filter((entry) => entry.tournamentId !== null)
      const results = await Promise.allSettled(
        targets.map(async (entry) => ({
          competitionKey: entry.competition.seasonRowName,
          competitionName: entry.competition.name,
          view: presentFixtureList(await fetchSeasonFixtureList(entry.tournamentId as string, {})),
        })),
      )
      if (!active) return
      const resolved = results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      )
      setSources(resolved)
      // The visit counts as seen only now, and only if at least one competition
      // answered. A total read failure leaves the marker where it was, so the
      // next visit still shows what changed.
      if (resolved.length > 0) writeLastVisit(new Date())
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, player === null])

  const today = matchDayKey(new Date().toISOString()) ?? ''
  const football = useMemo(
    () => (sources ? presentCombinedFixtures(sources, [], 'today', today) : null),
    [sources, today],
  )
  // What the results did to the player (contracts 151 and 150). Bounded, and
  // the bound is stated in the section below rather than applied silently.
  const recap = useMatchweekRecap(player, userId)
  // Contract 157's pinned rival, compared inside a league table the player is
  // already a member of. It adds no read of its own beyond that table, and
  // renders nothing at all when there is no rival to watch.
  const rivalWatch = useRivalWatch(player, preferences, reload)

  const since = useMemo(() => {
    if (!sources) return null
    const all = sources.flatMap((source) =>
      source.view.days.flatMap((day) =>
        day.rows.map((row) => ({
          ...row,
          competitionKey: source.competitionKey,
          competitionName: source.competitionName,
        })),
      ),
    )
    return presentSinceLastVisit(all, lastVisit)
  }, [sources, lastVisit])

  const hrefFor = (row: CombinedFixtureRow): string | null => {
    const entry = (player?.mine ?? []).find(
      (candidate) => candidate.competition.seasonRowName === row.competitionKey,
    )
    if (!entry) return null
    return competitionMatchCentreRoute(
      {
        competitionSlug: entry.competition.competitionSlug,
        seasonSlug: entry.competition.seasonSlug,
      },
      row.id,
    )
  }

  if (membership === 'loading') {
    return (
      <div className={s.page} aria-busy="true">
        <h1 className={s.title}>Home</h1>
        <Skeleton width="100%" height={104} />
        <Skeleton width="100%" height={72} />
      </div>
    )
  }

  if (membership === 'failed') {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Home</h1>
        <Alert variant="error" title="We could not load your competitions">
          Nothing is claimed either way — your entries and predictions are unaffected.
        </Alert>
        <Button variant="secondary" onClick={reload}>
          Try again
        </Button>
      </div>
    )
  }

  if (player !== null && player.empty) {
    return (
      <div className={s.page}>
        <h1 className={s.title}>Home</h1>
        <EmptyState
          title="Pick a competition to play in"
          description="Follow the football you care about and join only the games you want. Your account, profile and career record carry across every season."
          action={
            <Link className={h.exploreLink} to={weeklyRoutes.competitions}>
              Browse competitions
            </Link>
          }
        />
      </div>
    )
  }

  const outstanding = [...(inbox?.urgent ?? []), ...(inbox?.thisWeek ?? [])]
  const primary = outstanding[0] ?? null
  const secondary = outstanding.slice(1, 3)

  /**
   * INNOV-016. Assembled from what this page has already read — the action
   * inbox, today's fixtures and whichever standing is available — and adding no
   * request of its own. Where the two standings disagree in scope the LEAGUE one
   * wins: it is the table a player checks, and it carries a named rival.
   */
  const rival = rivalWatch.watch?.pinned[0] ?? null
  const firstRecap = recap.recaps[0] ?? null
  const briefingStanding: BriefingStanding | null =
    rival && rivalWatch.leagueName
      ? {
          where: rivalWatch.leagueName,
          position: rival.yourRank,
          // A league comparison carries no field size, and inventing one from
          // the season's would name a different table.
          fieldSize: null,
          rivalName: rival.displayName,
          // Only when they are actually ahead. "0 points behind" for somebody
          // the player leads is a sentence that reads as bad news.
          pointsBehind: rival.pointsDifference < 0 ? Math.abs(rival.pointsDifference) : null,
        }
      : firstRecap && firstRecap.seasonRank !== null && firstRecap.fieldSize !== null
        ? {
            where: firstRecap.competitionName,
            position: firstRecap.seasonRank,
            fieldSize: firstRecap.fieldSize,
            rivalName: null,
            pointsBehind: null,
          }
        : null

  const todayRows = football?.days.flatMap((day) => day.rows) ?? []
  const briefing: BriefingInput = {
    now: new Date(),
    fixturesToday: todayRows.length,
    competitionsWithFixturesToday: new Set(todayRows.map((row) => row.competitionKey)).size,
    outstanding: outstanding.map((action) => ({
      competitionName: action.competitionName,
      gameName: action.gameName,
      title: action.title,
      locksAt: action.locksAt,
    })),
    standing: briefingStanding,
  }

  const aside = (
    <>
      <section className={h.panel} aria-labelledby="hub-today">
        <h2 className={h.panelTitle} id="hub-today">
          Today
        </h2>
        {football === null ? (
          <Skeleton width="100%" height={56} />
        ) : football.empty ? (
          <p className={h.panelNote}>No matches today in your competitions.</p>
        ) : (
          <ul className={h.fixtureList}>
            {football.days.flatMap((day) =>
              day.rows.map((row) => (
                <li key={`${row.competitionKey}-${row.id}`}>
                  <FixtureRow row={row} href={hrefFor(row)} />
                </li>
              )),
            )}
          </ul>
        )}
        <Link className={h.panelLink} to={weeklyRoutes.matches}>
          All matches
        </Link>
      </section>

      <section className={h.panel} aria-labelledby="hub-competitions">
        <h2 className={h.panelTitle} id="hub-competitions">
          Your competitions
        </h2>
        <ul className={h.competitionList}>
          {(player?.mine ?? []).map((entry) => (
            <li key={entry.competition.seasonRowName}>
              <Link className={h.competitionRow} to={competitionPath(entry.competition)}>
                <span className={h.competitionName}>{entry.competition.name}</span>
                <span className={h.competitionMeta}>
                  {entry.joinedGames.length === 1
                    ? '1 game'
                    : `${entry.joinedGames.length} games`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {/* Discovery, and deliberately last and quiet: the authority requires
            it not to compete with outstanding actions. */}
        <Link className={h.panelLink} to={weeklyRoutes.competitions}>
          All competitions
        </Link>
      </section>
    </>
  )

  return (
    <div className={s.page}>
      <Workspace aside={aside} asideLabel="Football and competitions">
        <h1 className={s.title}>Home</h1>

        {/* INNOV-016, above everything and replacing nothing: the sentence that
            tells a player whether they need to read the rest. It renders
            nothing at all on a quiet day. */}
        <BriefingPanel input={briefing} />

        <section className={h.section} aria-labelledby="hub-next">
          <h2 className={h.sectionTitle} id="hub-next">
            Next
          </h2>
          {inbox === null ? (
            <Skeleton width="100%" height={104} />
          ) : primary === null ? (
            <p className={h.allClear}>
              Nothing outstanding. Everything your games have asked for is done.
            </p>
          ) : (
            <>
              <PrimaryAction action={primary} />
              {secondary.length > 0 ? (
                <ul className={h.secondaryList}>
                  {secondary.map((action) => (
                    <li key={action.key}>
                      {action.href ? (
                        <Link className={h.secondary} to={action.href}>
                          <span className={h.secondaryWhere}>
                            {action.competitionName} · {action.gameName}
                          </span>
                          <span className={h.secondaryTitle}>{action.title}</span>
                        </Link>
                      ) : (
                        <div className={`${h.secondary} ${h.primaryInert}`}>
                          <span className={h.secondaryWhere}>
                            {action.competitionName} · {action.gameName}
                          </span>
                          <span className={h.secondaryTitle}>{action.title}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link className={h.panelLink} to={weeklyRoutes.play}>
                Everything to play
              </Link>
            </>
          )}
        </section>

        {/* Only for a returning player with something that actually finished.
            A first visit has no "since" and renders nothing at all. */}
        {since?.available && since.results.length > 0 ? (
          <section className={h.section} aria-labelledby="hub-since">
            <h2 className={h.sectionTitle} id="hub-since">
              Since you were last here
            </h2>
            <ul className={h.fixtureList}>
              {since.results.map((row) => (
                <li key={`since-${row.competitionKey}-${row.id}`}>
                  <FixtureRow row={row} href={hrefFor(row)} />
                </li>
              ))}
            </ul>
            {since.more > 0 ? (
              <p className={h.panelNote}>
                {since.more} more {since.more === 1 ? 'result' : 'results'} in your competitions.
              </p>
            ) : null}
          </section>
        ) : null}

        {/* What those results did to the player. Contract 151 supplies the
            banked matchweek points, the season position and the exact/correct
            counts; contract 150 supplies movement inside a private league.
            Nothing is estimated, and a competition with nothing settled
            contributes no card rather than an empty one. */}
        <RivalWatchCard state={rivalWatch} />

        {recap.status === 'ready' && recap.recaps.length > 0 ? (
          <section className={h.section} aria-labelledby="hub-recap">
            <h2 className={h.sectionTitle} id="hub-recap">
              Matchweek recap
            </h2>
            <ul className={h.fixtureList}>
              {recap.recaps.map((entry) => (
                <li key={entry.competitionKey}>
                  <Link className={h.competitionRow} to={entry.href}>
                    <span className={h.competitionName}>
                      {entry.competitionName} · {entry.matchweekLabel}
                    </span>
                    <span className={h.competitionMeta}>
                      {entry.points} pts
                      {entry.jokerPlayed ? ' · Joker' : ''}
                      {entry.exactScores !== null ? ` · ${entry.exactScores} exact` : ''}
                      {entry.correctOutcomes !== null
                        ? ` · ${entry.correctOutcomes} correct`
                        : ''}
                      {entry.seasonRank !== null && entry.fieldSize !== null
                        ? ` · ${ordinal(entry.seasonRank)} of ${entry.fieldSize}`
                        : ''}
                    </span>
                    {entry.leagues.map((league) => (
                      <span className={h.competitionMeta} key={league.leagueId}>
                        {league.leagueName}: {ordinal(league.rankBefore)} →{' '}
                        {ordinal(league.rankAfter)}
                        {league.movement > 0
                          ? ` · ↑${league.movement}`
                          : league.movement < 0
                            ? ` · ↓${Math.abs(league.movement)}`
                            : ' · no change'}
                      </span>
                    ))}
                  </Link>
                </li>
              ))}
            </ul>
            {recap.notCovered > 0 ? (
              // The bound, stated. A cap nobody can see reads as "we covered
              // everything".
              <p className={h.panelNote}>
                {recap.notCovered} more{' '}
                {recap.notCovered === 1 ? 'competition is' : 'competitions are'} not summarised
                here. Open one to see its matchweek.
              </p>
            ) : null}
          </section>
        ) : null}
      </Workspace>
    </div>
  )
}
