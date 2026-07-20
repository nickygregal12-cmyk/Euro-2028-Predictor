import { initialsOf, StatCard, TeamFlag, Button, type MatchTeam } from '../../design-system'
import { ChevronRightIcon, LockIcon, UsersIcon } from '../../design-system/icons'
import { PointsBreakdown } from '../scoring/PointsBreakdown'
import { ordinal } from '../league/ordinal'
import type { ScoreEvent } from '../../domain/tournament/scoreEvents'
import type { ProfileStats } from '../../domain/tournament/profileStats'
import s from '../shared.module.css'
import p from './profile.module.css'

export type ProfileHeaderData = {
  displayName: string
  isOwn: boolean
  // The player's champion pick; null if they haven't picked one yet.
  champion: MatchTeam | null
  // Tombstone treatment: dimmed flag + struck-through name once knocked out.
  championEliminated: boolean
  leaguesCount: number
}

export type ProfileFullStats = ProfileStats & { totalPoints: number; rank: number | null }

export type ProfileScreenProps =
  | {
      kind: 'full'
      header: ProfileHeaderData
      stats: ProfileFullStats
      events: ScoreEvent[]
      // The view-full-entry row is post-lock only (reveal rule); this flips it on.
      locked: boolean
      onViewEntry?: () => void
      onH2H?: () => void
      onEdit?: () => void
    }
  | {
      // Another player's profile before entries lock (reveal rule): name +
      // leagues + entry status only, everything else replaced by a lock card.
      kind: 'hidden'
      displayName: string
      leaguesCount: number
      hasEntry: boolean
      lockDateLabel: string
    }

function leaguesLine(n: number): string {
  return `${n} league${n === 1 ? '' : 's'}`
}

/**
 * The Profile page (design-system §6). Presentational: identity header, four-up
 * stat grid, the reused Points breakdown card, and the post-lock view-full-entry
 * row — or, for another player pre-lock, the reveal-gated hidden state. All data
 * and callbacks come from the caller.
 */
export function ProfileScreen(props: ProfileScreenProps) {
  if (props.kind === 'hidden') {
    return (
      <>
        <div className={p.headerCard}>
          <span className={p.avatar} aria-hidden="true">
            {initialsOf(props.displayName)}
          </span>
          <span className={p.headerBody}>
            <span className={p.name}>{props.displayName}</span>
            <span className={p.headerMeta}>
              <UsersIcon size={13} /> {leaguesLine(props.leaguesCount)} ·{' '}
              {props.hasEntry ? 'Entry in' : 'No entry yet'}
            </span>
          </span>
        </div>

        <div className={p.lockCard}>
          <LockIcon size={20} className={p.lockIcon} />
          <p className={p.lockText}>
            Predictions and stats are hidden until entries lock on {props.lockDateLabel}.
          </p>
        </div>
      </>
    )
  }

  const { header, stats, events, locked, onViewEntry, onH2H, onEdit } = props
  return (
    <>
      {/* Identity header */}
      <div className={p.headerCard}>
        <span className={p.avatar} aria-hidden="true">
          {initialsOf(header.displayName)}
        </span>
        <span className={p.headerBody}>
          <span className={p.name}>{header.displayName}</span>
          {header.champion ? (
            <span className={`${p.champion} ${header.championEliminated ? p.championOut : ''}`}>
              <TeamFlag
                countryCode={header.champion.countryCode}
                label={`Champion pick: ${header.champion.name}${header.championEliminated ? ' (eliminated)' : ''}`}
                size="venue"
              />
              <span className={p.championLabel}>Champion</span>
              <span className={`${p.championName} ${header.championEliminated ? p.strike : ''}`}>
                {header.champion.name}
              </span>
            </span>
          ) : (
            <span className={p.headerMeta}>No champion picked yet</span>
          )}
          <span className={p.headerMeta}>
            <UsersIcon size={13} /> {leaguesLine(header.leaguesCount)}
          </span>
        </span>
        <span className={p.headerAction}>
          {header.isOwn ? (
            <Button variant="secondary" onClick={onEdit} disabled title="Coming soon">
              Edit
            </Button>
          ) : (
            <Button variant="secondary" onClick={onH2H}>
              H2H
            </Button>
          )}
        </span>
      </div>

      {/* Stat grid — four up */}
      <div className={p.statGrid}>
        <StatCard label="Points" value={stats.totalPoints} />
        <StatCard label="Overall rank" value={stats.rank === null ? '–' : ordinal(stats.rank)} accent />
        <StatCard label="Exact scores" value={stats.exactScores} />
        <StatCard
          label="Accuracy"
          value={stats.accuracyPercent === null ? '–' : `${stats.accuracyPercent}%`}
        />
      </div>

      {/* Points breakdown card (reuses the existing component) */}
      <div className={p.breakdownCard}>
        <span className={s.eyebrow}>Points breakdown</span>
        <PointsBreakdown events={events} defaultExpanded />
      </div>

      {/* View full entry — post-lock only (reveal rule) */}
      {locked && (
        <button type="button" className={p.entryRow} onClick={onViewEntry}>
          View full entry
          <ChevronRightIcon size={18} className={p.entryChev} />
        </button>
      )}
    </>
  )
}
