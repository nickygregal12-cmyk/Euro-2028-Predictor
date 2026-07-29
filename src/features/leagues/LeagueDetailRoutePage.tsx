import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { areFinalStandingsActive } from '../../domain/tournament/finalStandings'
import { FinalStandingsNote } from '../league/FinalStandingsNote'
import { LeagueDetailPage } from './LeagueDetailPage'
import s from '../shared.module.css'

export function LeagueDetailRoutePage() {
  const tournament = useTournamentData()
  const finalStandings =
    tournament.status === 'ready' && areFinalStandingsActive(tournament.data.matches)

  return (
    <>
      <LeagueDetailPage />
      {finalStandings ? (
        <div className={s.page}>
          <FinalStandingsNote />
        </div>
      ) : null}
    </>
  )
}
