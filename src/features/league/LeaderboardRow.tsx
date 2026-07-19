import { initialsOf, TeamFlag, type MatchTeam } from '../../design-system'
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
  // The player's champion pick, shown as a small flag after the name (league
  // rows). Hidden pre-lock by the caller per the reveal rules (design-system §6);
  // pass `championEliminated` to dim it when the team is knocked out.
  championPick?: MatchTeam
  championEliminated?: boolean
}

/**
 * One standings row: rank · movement · avatar+name (+ YOU, + optional champion
 * flag) · total. Presentational only. The current user's row is chip-backed with
 * an accent avatar and a YOU chip (design-system §6); rank shows a dash
 * pre-results. Shared by the overall leaderboard (no champion pick) and league
 * rows (with one). The champion flag sits inside the flexible name cell, so the
 * outer column grid is unchanged whether or not it's present.
 */
export function LeaderboardRow({
  rank,
  name,
  points,
  isYou,
  movement = 'none',
  championPick,
  championEliminated = false,
}: LeaderboardRowProps) {
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
        {initialsOf(name)}
      </span>
      <span className={s.nameCell}>
        <span className={s.name}>{name}</span>
        {isYou && <span className={s.youChip}>YOU</span>}
        {championPick && (
          <span className={`${s.champion} ${championEliminated ? s.championOut : ''}`}>
            <TeamFlag
              countryCode={championPick.countryCode}
              label={`Champion pick: ${championPick.name}${championEliminated ? ' (eliminated)' : ''}`}
              size="venue"
            />
          </span>
        )}
      </span>
      <span className={s.points}>{points}</span>
    </div>
  )
}
