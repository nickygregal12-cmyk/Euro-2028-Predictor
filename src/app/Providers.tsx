import { Outlet } from 'react-router-dom'
import { AuthProvider } from '../features/auth/AuthProvider'
import { TournamentDataProvider } from './providers/TournamentDataProvider'
import { PredictionsProvider } from './providers/PredictionsProvider'

// The authenticated app tree: session → tournament reference data → the user's
// predictions. Wraps every in-shell route (but not /dev/components).
export function Providers() {
  return (
    <AuthProvider>
      <TournamentDataProvider>
        <PredictionsProvider>
          <Outlet />
        </PredictionsProvider>
      </TournamentDataProvider>
    </AuthProvider>
  )
}
