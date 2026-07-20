import { UsersIcon, ChevronRightIcon, ChevronUpIcon, ChevronDownIcon } from '../../design-system/icons'
import s from './hub.module.css'

export type MyLeagueCardProps = {
  name: string
  memberCount: number
  isOwner: boolean
  // The user's rank in this league, or null pre-results (shown as a dash).
  rank?: number | null
  movement?: 'up' | 'down' | 'none'
  onOpen: () => void
}

/**
 * One row in the My-leagues list: name (truncating), member count, an "owner"
 * tag where true, the user's rank + movement (placeholder pre-results), and a
 * chevron into the league detail. A real button (whole row tappable).
 */
export function MyLeagueCard({
  name,
  memberCount,
  isOwner,
  rank = null,
  movement = 'none',
  onOpen,
}: MyLeagueCardProps) {
  const first = rank === 1
  return (
    <button type="button" className={s.leagueCard} onClick={onOpen}>
      <span className={s.leagueBody}>
        <span className={s.leagueTop}>
          <span className={s.leagueName}>{name}</span>
          {isOwner && <span className={s.ownerTag}>You own this</span>}
        </span>
        <span className={s.leagueMeta}>
          <UsersIcon size={13} />
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </span>
      </span>

      <span className={s.leagueRank}>
        <span className={`${s.rankNum} ${first ? s.rankFirst : ''}`}>{rank ?? '–'}</span>
        <span className={s.rankMove} aria-hidden="true">
          {movement === 'up' ? (
            <ChevronUpIcon size={13} className={s.moveUp} />
          ) : movement === 'down' ? (
            <ChevronDownIcon size={13} className={s.moveDown} />
          ) : null}
        </span>
      </span>
      <ChevronRightIcon size={18} className={s.chev} />
    </button>
  )
}
