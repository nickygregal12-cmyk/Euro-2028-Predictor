import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { AdminResultsPage } from './AdminResultsPage'
import { AdminThirdPlaceResolutionPanel } from './AdminThirdPlaceResolutionPanel'
import s from '../shared.module.css'

export function AdminResultsWorkspacePage() {
  const tournament = useTournamentData()

  return (
    <>
      <AdminResultsPage />
      {tournament.status === 'ready' ? (
        <div className={s.page}>
          <AdminThirdPlaceResolutionPanel
            tournamentId={tournament.data.tournament.id}
            onChanged={tournament.reload}
          />
        </div>
      ) : null}
    </>
  )
}
