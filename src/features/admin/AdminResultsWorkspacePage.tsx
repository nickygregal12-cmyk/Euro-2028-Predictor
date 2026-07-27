import { useTournamentData } from '../../app/providers/TournamentDataProvider'
import { AdminResultsPage } from './AdminResultsPage'
import { AdminThirdPlaceResolutionPanel } from './AdminThirdPlaceResolutionPanel'
import s from '../shared.module.css'
import q from './adminThirdPlaceResolution.module.css'

export function AdminResultsWorkspacePage() {
  const tournament = useTournamentData()

  return (
    <>
      <AdminResultsPage />
      {tournament.status === 'ready' ? (
        <div className={s.page}>
          <div className={q.scope}>
            <AdminThirdPlaceResolutionPanel
              tournamentId={tournament.data.tournament.id}
              onChanged={tournament.reload}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
