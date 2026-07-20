import { ChevronRightIcon, TrophyIcon, UsersIcon } from '../../design-system/icons'
import { ordinal } from '../league/ordinal'
import type { LeagueStanding } from '../../domain/tournament/homeDashboard'
import h from './home.module.css'

export type LeagueSnapshotProps = {
  league: LeagueStanding | null
  onOpen: (leagueId: string) => void
  onCreate: () => void
}

/**
 * The Home league snapshot (design-system §6): the user's best league — name,
 * their position of N, gap to the top — tapping into the league detail. With no
 * leagues it becomes a quiet "create a league" prompt. Presentational.
 */
export function LeagueSnapshot({ league, onOpen, onCreate }: LeagueSnapshotProps) {
  if (!league) {
    return (
      <button type="button" className={h.snapshotEmpty} onClick={onCreate}>
        <span className={h.snapshotIcon}>
          <UsersIcon size={20} />
        </span>
        <span className={h.snapshotBody}>
          <span className={h.snapshotTitle}>Play your mates</span>
          <span className={h.snapshotSub}>Create a private league or join one with a code.</span>
        </span>
        <ChevronRightIcon size={18} className={h.snapshotChev} />
      </button>
    )
  }

  const gap =
    league.gapToTop === null
      ? null
      : league.gapToTop === 0
        ? 'Leading'
        : `${league.gapToTop} pt${league.gapToTop === 1 ? '' : 's'} behind top`

  return (
    <button type="button" className={h.snapshot} onClick={() => onOpen(league.id)}>
      <span className={`${h.snapshotIcon} ${league.rank === 1 ? h.snapshotIconLead : ''}`}>
        <TrophyIcon size={20} />
      </span>
      <span className={h.snapshotBody}>
        <span className={h.snapshotName}>{league.name}</span>
        <span className={h.snapshotSub}>
          {league.rank === null
            ? `${league.memberCount} member${league.memberCount === 1 ? '' : 's'}`
            : `${ordinal(league.rank)} of ${league.memberCount}${gap ? ` · ${gap}` : ''}`}
        </span>
      </span>
      <ChevronRightIcon size={18} className={h.snapshotChev} />
    </button>
  )
}
