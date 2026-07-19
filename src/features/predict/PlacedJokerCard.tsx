import { Button, TeamFlag, type MatchTeam } from '../../design-system'
import { CardsIcon, LockIcon } from '../../design-system/icons'
import s from './placedJoker.module.css'

export type PlacedJokerCardProps = {
  // eyebrow
  group: string
  matchday: number
  date: string
  // teams + the user's predicted score
  home: MatchTeam
  away: MatchTeam
  homeScore: number | null
  awayScore: number | null
  // committed = the match has kicked off; the joker is spent and frozen (gold,
  // permanent, no actions). Otherwise it's movable.
  committed: boolean
  onRemove?: () => void
  onMove?: () => void
}

/**
 * One placed joker on the Jokers overview. Read-and-manage, not a placement UI:
 * a movable joker shows a gold "Joker on" status pill plus remove/move actions;
 * a committed joker shows a gold "Committed" pill and nothing to act on. Gold is
 * used for nothing else in the app (design-system §5); status is a tint pill,
 * never a solid fill (that's reserved for CTAs).
 */
export function PlacedJokerCard({
  group,
  matchday,
  date,
  home,
  away,
  homeScore,
  awayScore,
  committed,
  onRemove,
  onMove,
}: PlacedJokerCardProps) {
  return (
    <section className={s.card} aria-label={`Joker on ${home.name} v ${away.name}`}>
      <div className={s.eyebrow}>
        <span>
          Group {group} · MD{matchday}
        </span>
        <span>{date}</span>
      </div>

      <div className={s.teamRow}>
        <span className={`${s.team} ${s.teamHome}`}>
          <TeamFlag countryCode={home.countryCode} label={home.name} size="card" />
          <span className={s.teamName}>{home.name}</span>
        </span>
        <span className={s.score}>
          <span className={s.scoreNum}>{homeScore ?? '–'}</span>
          <span className={s.sep}>–</span>
          <span className={s.scoreNum}>{awayScore ?? '–'}</span>
        </span>
        <span className={`${s.team} ${s.teamAway}`}>
          <span className={s.teamName}>{away.name}</span>
          <TeamFlag countryCode={away.countryCode} label={away.name} size="card" />
        </span>
      </div>

      <div className={s.footer}>
        {committed ? (
          <span className={`${s.pill} ${s.pillCommitted}`}>
            <LockIcon size={13} /> Committed · 2× locked in
          </span>
        ) : (
          <span className={`${s.pill} ${s.pillOn}`}>
            <CardsIcon size={13} /> Joker on · doubles points
          </span>
        )}

        {!committed && (
          <span className={s.actions}>
            {onMove && (
              <button type="button" className={s.moveLink} onClick={onMove}>
                Move
              </button>
            )}
            {onRemove && (
              <Button variant="secondary" onClick={onRemove}>
                Remove
              </Button>
            )}
          </span>
        )}
      </div>
    </section>
  )
}
