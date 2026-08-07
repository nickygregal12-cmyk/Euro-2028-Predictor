import { useNavigate } from 'react-router'
import { Button } from '../../design-system'
import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { areFinalStandingsActive } from '../../domain/tournament/finalStandings'
import { FinalStandingsNote } from '../league/FinalStandingsNote'
import { LeagueDetailPage } from './LeagueDetailPage'
import s from '../shared.module.css'

export function LeagueDetailRoutePage() {
  const navigate = useNavigate()
  const tournament = useTournamentData()
  const finalStandings =
    tournament.status === 'ready' && areFinalStandingsActive(tournament.data.matches)

  return (
    <>
      <div className={s.page}>
        <Button variant="secondary" onClick={() => navigate('/leagues')}>
          Back to Leagues
        </Button>
      </div>
      <LeagueDetailPage />
      {finalStandings ? (
        <div className={s.page}>
          <FinalStandingsNote />
        </div>
      ) : null}
    </>
  )
}
