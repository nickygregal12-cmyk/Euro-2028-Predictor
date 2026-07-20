import { initialsOf, TeamFlag, type MatchTeam } from '../../design-system'
import { ChevronUpIcon, ChevronDownIcon } from '../../design-system/icons'
import s from './LeagueMemberRow.module.css'

export type MemberStats = {
  // null = not yet scored / hidden — shown as a dash.
  exact: number | null
  correct: number | null
  maxLeft: number | null
}

export type LeagueMemberRowProps = {
  // Standard-competition rank (shared on ties), or null pre-results.
  rank: number | null
  name: string
  totalPoints: number
  // Latest-matchday points; null pre-results or for a member with no entry.
  latestPoints?: number | null
  isYou?: boolean
  // Movement vs the previous matchday. Placeholder in Phase 2 (no rank history
  // yet): 'none' renders a muted dash.
  movement?: 'up' | 'down' | 'none'
  // The member has a submitted entry. When false the row is dimmed and shows
  // "No entry" (post-lock) or entry progress (pre-deadline, see `progress`).
  hasEntry: boolean
  // Pre-deadline progress for a member without a submitted entry ("12/36
  // predicted"). Ignored once `hasEntry` is true.
  progress?: { predicted: number; total: number } | null
  // Champion pick, revealed only post-lock by the caller (reveal rules). Dims
  // when the picked team is eliminated.
  championPick?: MatchTeam
  championEliminated?: boolean
  // Expansion is controlled by the parent (one row open at a time).
  expanded: boolean
  onToggle: () => void
  // Expanded content. When `revealed` is false and this isn't you, stats stay
  // hidden behind a reveal-rules note instead of the stat triple + actions.
  revealed?: boolean
  stats?: MemberStats
  onProfile?: () => void
  onHeadToHead?: () => void
}

function statValue(n: number | null | undefined): string {
  return n === null || n === undefined ? '–' : String(n)
}

/**
 * One league standings row: collapsed grid (rank · movement · avatar+name ·
 * champion flag · latest · total) that expands in place to a stat triple (Exact
 * / Correct / Max left) plus Profile and Head-to-head actions. The current
 * user's row is chip-backed with an accent avatar + YOU chip; members without an
 * entry are dimmed. Presentational only — ranking, reveal gating and the expand
 * state are decided by the caller.
 */
export function LeagueMemberRow({
  rank,
  name,
  totalPoints,
  latestPoints,
  isYou = false,
  movement = 'none',
  hasEntry,
  progress,
  championPick,
  championEliminated = false,
  expanded,
  onToggle,
  revealed = false,
  stats,
  onProfile,
  onHeadToHead,
}: LeagueMemberRowProps) {
  const dimmed = !hasEntry
  return (
    <div className={`${s.block} ${isYou ? s.blockYou : ''} ${dimmed ? s.dim : ''}`}>
      <button
        type="button"
        className={s.row}
        onClick={onToggle}
        aria-expanded={expanded}
        aria-current={isYou ? 'true' : undefined}
      >
        <span className={s.rank}>{rank ?? '–'}</span>
        <span className={s.movement} aria-hidden="true">
          {movement === 'up' ? (
            <ChevronUpIcon size={13} className={s.moveUp} />
          ) : movement === 'down' ? (
            <ChevronDownIcon size={13} className={s.moveDown} />
          ) : (
            <span className={s.moveNone}>–</span>
          )}
        </span>
        <span className={`${s.avatar} ${isYou ? s.avatarYou : ''}`} aria-hidden="true">
          {initialsOf(name)}
        </span>
        <span className={s.nameCell}>
          <span className={s.nameLine}>
            <span className={s.name}>{name}</span>
            {isYou && <span className={s.youChip}>YOU</span>}
            {championPick && (
              <span className={`${s.champion} ${championEliminated ? s.championOut : ''}`}>
                <TeamFlag
                  countryCode={championPick.countryCode}
                  label={`Champion pick: ${championPick.name}${
                    championEliminated ? ' (eliminated)' : ''
                  }`}
                  size="venue"
                />
              </span>
            )}
          </span>
          {dimmed && (
            <span className={s.sub}>
              {progress ? `${progress.predicted}/${progress.total} predicted` : 'No entry'}
            </span>
          )}
        </span>
        <span className={s.latest}>{hasEntry ? statValue(latestPoints) : '–'}</span>
        <span className={s.total}>{hasEntry ? totalPoints : 0}</span>
        <span className={s.chev} aria-hidden="true">
          {expanded ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
        </span>
      </button>

      {expanded && (
        <div className={s.panel}>
          {revealed || isYou ? (
            <>
              <div className={s.statTriple}>
                <span className={s.stat}>
                  <span className={s.statValue}>{statValue(stats?.exact)}</span>
                  <span className={s.statLabel}>Exact</span>
                </span>
                <span className={s.stat}>
                  <span className={s.statValue}>{statValue(stats?.correct)}</span>
                  <span className={s.statLabel}>Correct</span>
                </span>
                <span className={s.stat}>
                  <span className={`${s.statValue} ${s.statAccent}`}>
                    {statValue(stats?.maxLeft)}
                  </span>
                  <span className={s.statLabel}>Max left</span>
                </span>
              </div>
              <div className={s.actions}>
                <button type="button" className={s.action} onClick={onProfile}>
                  Profile
                </button>
                {!isYou && (
                  <button type="button" className={s.action} onClick={onHeadToHead}>
                    Head to head
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className={s.hidden}>Stats are hidden until entries lock.</p>
          )}
        </div>
      )}
    </div>
  )
}
