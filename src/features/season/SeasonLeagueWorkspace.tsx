import { useEffect, useState } from 'react'
import type { SeasonLeagueStandingsGateway } from './leagueStandingsModel'
import type { SeasonLeagueMatchweekPredictions } from '../../services/supabase/seasonLeaguePredictionsModel'
import type { SeasonLeagueMovement } from '../../services/supabase/seasonLeagueMovementModel'
import { presentLeagueMovement, type LeagueMovementLine } from './leagueFixtureModel'
import { ordinal } from '../league/ordinal'
import { SeasonLeagueMatchweek } from './SeasonLeagueMatchweek'
import { SeasonLeagueMembers } from './SeasonLeagueMembers'
import {
  SeasonLeagueStandings,
  type SeasonLeagueStandingsProps,
} from './SeasonLeagueStandings'
import styles from './SeasonLeagueWorkspace.module.css'

/**
 * A private league as a workspace: **Table · Matchweek · Members**.
 *
 * WHY IT IS THREE VIEWS AND NOT ONE TABLE. The accepted destination has been
 * Table / Matchweek / Members since the August 2026 workshop, and the previous
 * UI session stopped at the table alone because the read behind Matchweek did
 * not exist. Contract 149 supplies it and contract 128 already answered
 * Members, so the workspace is completable without a new authority.
 *
 * THE TABS ANSWER DIFFERENT QUESTIONS, which is why they are tabs rather than
 * sections stacked on one page: "who is winning", "what did we all predict this
 * week", "who am I playing with". Stacking them would make the third require
 * scrolling past the first two on a phone every time.
 *
 * MOVEMENT SITS ABOVE THE TABS, not inside one, because it is a fact about the
 * league rather than about a view of it — and it is rendered only when contract
 * 150 says the matchweek SETTLED. An unsettled matchweek produces no line at
 * all: reporting a climb out of totals that are still changing would show a
 * player a position they never held.
 *
 * NO RULE IS DUPLICATED HERE. Reveal is contract 149's, ranking is contract
 * 128's, movement is contract 150's, and points are the season's throughout.
 */

export type SeasonLeagueTab = 'table' | 'matchweek' | 'members'

export const LEAGUE_TABS: readonly { key: SeasonLeagueTab; label: string }[] = [
  { key: 'table', label: 'Table' },
  { key: 'matchweek', label: 'Matchweek' },
  { key: 'members', label: 'Members' },
]

export function isSeasonLeagueTab(value: string | null): value is SeasonLeagueTab {
  return value === 'table' || value === 'matchweek' || value === 'members'
}

export type SeasonLeagueWorkspaceProps = {
  leagueId: string
  leagueName: string
  standings: SeasonLeagueStandingsGateway
  headToHead?: SeasonLeagueStandingsProps['headToHead']
  /** The matchweek the Matchweek tab opens at, as a competition round id. */
  competitionRoundId: string | null
  loadMatchweek: (
    leagueId: string,
    competitionRoundId: string,
  ) => Promise<SeasonLeagueMatchweekPredictions>
  loadMovement?: (leagueId: string) => Promise<SeasonLeagueMovement>
  playerHref?: (playerId: string) => string
  /** The open tab, and how to change it. Held by the route so Back restores it. */
  tab: SeasonLeagueTab
  onTabChange: (tab: SeasonLeagueTab) => void
}

export function SeasonLeagueWorkspace({
  leagueId,
  leagueName,
  standings,
  headToHead,
  competitionRoundId,
  loadMatchweek,
  loadMovement,
  playerHref,
  tab,
  onTabChange,
}: SeasonLeagueWorkspaceProps) {
  const [movement, setMovement] = useState<LeagueMovementLine | null>(null)
  /**
   * The same answer, kept whole. The line above is the caller's own row; the
   * `INNOV-012` honours need every member's climb, and re-reading contract 150
   * for that would be the same request twice.
   */
  const [movementPage, setMovementPage] = useState<SeasonLeagueMovement | null>(null)

  useEffect(() => {
    if (!loadMovement) return
    let active = true
    setMovement(null)
    setMovementPage(null)
    loadMovement(leagueId)
      .then((answer) => {
        if (active) setMovementPage(answer)
        // `presentLeagueMovement` returns null unless the matchweek settled and
        // the caller has a row, so an unsettled league renders nothing rather
        // than an empty line where a climb should be.
        if (active) setMovement(presentLeagueMovement(answer))
      })
      .catch(() => {
        // Movement is context, never the point of the page. A failed read
        // withholds the line instead of putting an error over the table.
        if (active) {
          setMovement(null)
          setMovementPage(null)
        }
      })
    return () => {
      active = false
    }
  }, [leagueId, loadMovement])

  return (
    <div className={styles.workspace}>
      {movement ? <MovementLine movement={movement} /> : null}

      <div className={styles.tabs} role="tablist" aria-label={`${leagueName} views`}>
        {LEAGUE_TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="tab"
            id={`league-${leagueId}-tab-${entry.key}`}
            aria-selected={tab === entry.key}
            aria-controls={`league-${leagueId}-panel-${entry.key}`}
            className={tab === entry.key ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => onTabChange(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`league-${leagueId}-panel-${tab}`}
        aria-labelledby={`league-${leagueId}-tab-${tab}`}
      >
        {tab === 'table' ? (
          <SeasonLeagueStandings
            gateway={standings}
            leagueId={leagueId}
            leagueName={leagueName}
            headToHead={headToHead}
          />
        ) : tab === 'matchweek' ? (
          <SeasonLeagueMatchweek
            leagueId={leagueId}
            leagueName={leagueName}
            competitionRoundId={competitionRoundId}
            load={loadMatchweek}
            playerHref={playerHref}
            movement={movementPage}
          />
        ) : (
          <SeasonLeagueMembers
            gateway={standings}
            leagueId={leagueId}
            leagueName={leagueName}
            playerHref={playerHref}
          />
        )}
      </div>
    </div>
  )
}

function MovementLine({ movement }: { movement: LeagueMovementLine }) {
  const direction =
    movement.movement > 0
      ? { className: styles.movementUp, text: `↑${movement.movement}` }
      : movement.movement < 0
        ? { className: styles.movementDown, text: `↓${Math.abs(movement.movement)}` }
        : { className: styles.movementLevel, text: 'no change' }

  return (
    <p className={styles.movement}>
      <span className={styles.movementRank}>
        {ordinal(movement.rankBefore)} → {ordinal(movement.rankAfter)}
      </span>
      <span className={direction.className}>{direction.text}</span>
      <span>
        {movement.matchweekLabel ?? 'the last settled matchweek'}
        {movement.pointsThisMatchweek !== null ? ` · ${movement.pointsThisMatchweek} pts` : ''}
        {movement.gapToLeaderAfter > 0 ? ` · ${movement.gapToLeaderAfter} behind the leader` : ''}
      </span>
    </p>
  )
}
