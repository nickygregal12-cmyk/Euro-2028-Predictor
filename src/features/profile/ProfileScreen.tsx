import {
  Alert,
  initialsOf,
  StatCard,
  TeamFlag,
  Button,
  type MatchTeam,
} from '../../design-system'
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
  // Null means the league source was unavailable, never a successful zero.
  leaguesCount: number | null
}

export type ProfileFullStats = ProfileStats & {
  // Null means the leaderboard source was unavailable, never a false zero.
  totalPoints: number | null
  rank: number | null
}

export type ProfileDataAvailability = {
  leaderboard: boolean
  leagues: boolean
  scoreEvents: boolean
}

const ALL_AVAILABLE: ProfileDataAvailability = {
  leaderboard: true,
  leagues: true,
  scoreEvents: true,
}

export type ProfileScreenProps =
  | {
      kind: 'full'
      header: ProfileHeaderData
      stats: ProfileFullStats
      events: ScoreEvent[] | null
      availability?: ProfileDataAvailability
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

function leaguesLine(count: number | null): string {
  if (count === null) return 'Leagues unavailable'
  return `${count} league${count === 1 ? '' : 's'}`
}

/**
 * The Profile page (design-system §6). Presentational: identity header, four-up
 * stat grid, the reused Points breakdown card, and the post-lock view-full-entry
 * row — or, for another player pre-lock, the reveal-gated hidden state. All data
 * and callbacks come from the caller.
 *
 * Remote-source availability is explicit. Missing leaderboard, league or score-
 * event data must never be rendered as zero points, no leagues or an empty points
 * breakdown.
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

  const {
    header,
    stats,
    events,
    availability = ALL_AVAILABLE,
    locked,
    onViewEntry,
    onH2H,
    onEdit,
  } = props
  const partiallyUnavailable = Object.values(availability).some((available) => !available)

  return (
    <>
      {partiallyUnavailable && (
        <Alert variant="warning" title="Some profile data is unavailable">
          Your saved entry and scored points are unaffected. Missing figures will return when the
          connection recovers.
        </Alert>
      )}

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
        <StatCard
          label={availability.leaderboard ? 'Points' : 'Points unavailable'}
          value={availability.leaderboard ? (stats.totalPoints ?? 0) : '–'}
        />
        <StatCard
          label={availability.leaderboard ? 'Overall rank' : 'Rank unavailable'}
          value={
            availability.leaderboard && stats.rank !== null ? ordinal(stats.rank) : '–'
          }
          accent
        />
        <StatCard label="Exact scores" value={stats.exactScores} />
        <StatCard
          label="Accuracy"
          value={stats.accuracyPercent === null ? '–' : `${stats.accuracyPercent}%`}
        />
      </div>

      {/* Points breakdown card (reuses the existing component) */}
      <div className={p.breakdownCard}>
        <span className={s.eyebrow}>Points breakdown</span>
        {availability.scoreEvents && events !== null ? (
          <PointsBreakdown events={events} defaultExpanded />
        ) : (
          <p className={s.sub}>Points breakdown unavailable. Your scored points are unchanged.</p>
        )}
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
