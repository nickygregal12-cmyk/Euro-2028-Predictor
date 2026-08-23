import { useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { VNextWrappedScreen } from '../../vnext/integration/wrapped/VNextWrappedScreen'
import { VNextAppRoot } from './VNextAppRoot'
import { useShellIntentNavigation, useViewerFormatting } from './seam'

/**
 * SEASON WRAPPED, at `/competitions/:c/:s/wrapped`.
 *
 * ============================ THE GAP THIS CLOSES =======================
 *
 * Contract 156 has stored an immutable end-of-season archive since `MIG-UI-08`
 * and NOTHING has ever rendered it. The legacy profile prints a finished
 * season's points and rank from contract 161's participation history — four
 * figures out of a record that also holds the best matchweek, the accuracy
 * counts and the jokers. The archive was written and never read.
 *
 * ============================ WHAT THIS FILE DOES =======================
 *
 * Almost nothing, and that is the shape. It supplies the route slugs and the
 * reader's name, and the shell's intents so the frame can navigate. Every
 * decision about what a Wrapped SAYS belongs to `buildWrappedModel`, and every
 * figure in it belongs to the archive.
 *
 * There is no write on this path and there never can be: `season_wrapped` is
 * immutable by trigger, which is exactly what makes the page worth having.
 */
export function VNextWrappedDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading, displayName } = useAuth()
  const onShellIntent = useShellIntentNavigation()

  return (
    <VNextAppRoot>
      <VNextWrappedScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        playerName={displayName}
        onShellIntent={onShellIntent}
      />
    </VNextAppRoot>
  )
}
