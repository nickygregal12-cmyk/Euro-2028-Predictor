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
  // Null means the league source is unavailable, not that the player has none.
  leaguesCount: number | null
}

export type ProfileFullStats = ProfileStats & {
  // Null means the leaderboard source is unavailable, not zero points.
  totalPoints: number | null
  rank: number | null
}

export type ProfileDataAvailability = {
  leaderboard: boolean
  leagues: boolean
  events: boolean
}

type ProfileSummaryProps = {
  displayName: string
  leaguesCount: number
}

export type ProfileScreenProps =
  | {
      kind: 'full'
      header: ProfileHeaderData
      stats: ProfileFullStats
      events: ScoreEvent[]
      availability?: Partial<ProfileDataAvailability>
      // The view-full-entry row is post-lock only (reveal rule); this flips it on.
      locked: boolean
      onViewEntry?: () => void
      onH2H?: () => void
      onEdit?: () => void
    }
  | (ProfileSummaryProps & {
      // Another player's profile before entries lock (reveal rule): name +
      // leagues + entry status only, everything else replaced by a lock card.
      kind: 'hidden'
      hasEntry: boolean
      lockDateLabel: string
    })
  | (ProfileSummaryProps & {
      // Post-lock co-member with no submitted entry. This is distinct from the
      // hidden state: there is nothing to reveal after the deadline.
      kind: 'empty'
    })

function leaguesLine(count: number | null): string {
  if (count === null) return 'Leagues unavailable'
  return `${count} league${count === 1 ? '' : 's'}`
}

function SummaryHeader({ displayName, leaguesCount }: ProfileSummaryProps) {
  return (
    <div className={p.headerCard}>
      <span className={p.avatar} aria-hidden="true">
        {initialsOf(displayName)}
      </span>
      <span className={p.headerBody}>
        <span className={p.name}>{displayName}</span>
        <span className={p.headerMeta}>
          <UsersIcon size={13} /> {leaguesLine(leaguesCount)}
        </span>
      </span>
    </div>
  )
}

/**
 * The Profile page (design-system §6). Presentational: identity header, four-up
 * stat grid, the reused Points breakdown card, and the post-lock view-full-entry
 * row — or a reveal-gated/empty other-player state. All data and callbacks come
 * from the caller.
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

  if (props.kind === 'empty') {
    return (
      <>
        <SummaryHeader
          displayName={props.displayName}
          leaguesCount={props.leaguesCount}
        />
        <Alert variant="info" title="No submitted entry">
          This player did not submit an Original Predictor entry before the deadline.
        </Alert>
      </>
    )
  }

  const { header, stats, events, locked, onViewEntry, onH2H, onEdit } = props
  const availability: ProfileDataAvailability = {
    leaderboard: props.availability?.leaderboard ?? true,
    leagues: props.availability?.leagues ?? true,
    events: props.availability?.events ?? true,
  }

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
            <UsersIcon size={13} />{' '}
            {availability.leagues ? leaguesLine(header.leaguesCount) : 'Leagues unavailable'}
          </span>
        </span>
        <span className={p.headerAction}>
          {header.isOwn ? (
            <Button variant="secondary" onClick={onEdit}>
              Edit
            </Button>
          ) : onH2H ? (
            <Button variant="secondary" onClick={onH2H}>
              H2H
            </Button>
          ) : null}
        </span>
      </div>

      {/* Stat grid — four up */}
      <div className={p.statGrid}>
        <StatCard
          label={availability.leaderboard ? 'Points' : 'Points unavailable'}
          value={availability.leaderboard ? (stats.totalPoints ?? '–') : '–'}
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
        {availability.events ? (
          <PointsBreakdown events={events} defaultExpanded />
        ) : (
          <Alert variant="warning" title="Points breakdown unavailable">
            Your points history is still saved. This section will return when the connection
            recovers.
          </Alert>
        )}
      </div>

      {/* View full entry — post-lock only and only when the caller supplies it. */}
      {locked && onViewEntry && (
        <button type="button" className={p.entryRow} onClick={onViewEntry}>
          View full entry
          <ChevronRightIcon size={18} className={p.entryChev} />
        </button>
      )}
    </>
  )
}
