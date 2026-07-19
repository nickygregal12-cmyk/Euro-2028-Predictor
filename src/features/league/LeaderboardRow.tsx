import { ChevronUpIcon, ChevronDownIcon } from '../../design-system/icons'
import s from './leaderboard.module.css'

export type LeaderboardRowProps = {
  // Standard-competition rank (shared on ties), or null pre-results.
  rank: number | null
  name: string
  points: number
  isYou?: boolean
  // Movement vs the previous matchday. A placeholder in v0.1 (no history yet):
  // 'none' renders a muted dash.
  movement?: 'up' | 'down' | 'none'
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * One overall-standings row: rank · movement · avatar+name (+ YOU) · total.
 * Presentational only. The current user's row is chip-backed with an accent
 * avatar and a YOU chip (design-system §6). Rank shows a dash pre-results.
 */
export function LeaderboardRow({ rank, name, points, isYou, movement = 'none' }: LeaderboardRowProps) {
  return (
    <div
      className={`${s.row} ${isYou ? s.rowYou : ''}`}
      aria-current={isYou ? 'true' : undefined}
    >
      <span className={s.rank}>{rank ?? '–'}</span>
      <span className={s.movement} aria-hidden="true">
        {movement === 'up' ? (
          <ChevronUpIcon size={14} className={s.moveUp} />
        ) : movement === 'down' ? (
          <ChevronDownIcon size={14} className={s.moveDown} />
        ) : (
          <span className={s.moveNone}>–</span>
        )}
      </span>
      <span className={`${s.avatar} ${isYou ? s.avatarYou : ''}`} aria-hidden="true">
        {initials(name)}
      </span>
      <span className={s.nameCell}>
        <span className={s.name}>{name}</span>
        {isYou && <span className={s.youChip}>YOU</span>}
      </span>
      <span className={s.points}>{points}</span>
    </div>
  )
}
