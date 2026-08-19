import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextDiscoveryScreen } from '../vnext/integration/discovery/VNextDiscoveryScreen'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * vNEXT DISCOVERY AGAINST REAL DATA — a `/dev` harness.
 *
 * ============================ IT WRITES. READ THIS ONE. =================
 *
 * FOLLOW AND UNFOLLOW ARE LIVE. Pressing either calls
 * `set_competition_follow` against the account this browser is signed in as. A
 * follow is not a game entry — contract 157's migration refuses to install if
 * it ever becomes one — so nothing here can enter a competition. But it does
 * change what appears on that account's Home, and unfollowing DELETES the
 * follow row, which takes any favourite club stored on it with it.
 *
 * That last part is the reason this surface has no toggle: the write is an
 * upsert whose favourite argument defaults to null, so a follow re-sent for a
 * competition already followed would clear the favourite. Follow is offered
 * only where the player does not follow, and only where the page KNOWS.
 *
 * ============================ WHAT IS WORTH CHECKING ====================
 *
 *   A. does the catalogue arrive with seasons whose status is null? The page
 *      prints nothing rather than inventing a word;
 *   B. does the preferences read ever fail in practice? That is the state the
 *      surface is careful about, and it is hard to produce deliberately.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ==============
 *
 * Behind `import.meta.env.DEV` at its import site in `App.tsx`. THE PRODUCTION
 * `/competitions` SURFACE IS UNTOUCHED.
 */
export function VNextDiscoveryPreview() {
  return (
    <AuthProvider>
      <VNextRoot>
        <DiscoveryHarness />
      </VNextRoot>
    </AuthProvider>
  )
}

function DiscoveryHarness() {
  const { userId, loading } = useAuth()
  const [note, setNote] = useState('')
  const onShellIntent = useShellIntentHost(setNote)
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Discovery — real data</h2>
        <p className={styles.note}>
          Development harness. Reads contract 147
          <code> get_published_weekly_seasons</code> and contract 157
          <code> get_my_preferences</code>, and renders the Stage 13 catalogue
          unchanged. Not a product route.
        </p>
        <p className={styles.warning}>
          <strong>Follow and Unfollow are live.</strong> They call{' '}
          <code>set_competition_follow</code> against the account you are signed
          in as, changing what appears on its Home. Unfollowing deletes the
          follow row and takes any favourite club stored on it. Following never
          enters you into a game — the server refuses to let it.
        </p>
        {note ? <p className={styles.note}>{note}</p> : null}
      </header>

      <VNextDiscoveryScreen
        userId={userId}
        authLoading={loading}
        onShellIntent={onShellIntent}
        onOpenSeason={(route) =>
          navigate(`/competitions/${route.competitionSlug}/${route.seasonKey}`)
        }
      />
    </div>
  )
}

function useShellIntentHost(report: (message: string) => void) {
  const navigate = useNavigate()
  return useCallback(
    (intent: ShellIntent) => {
      switch (intent.kind) {
        case 'discover':
          report('You are already on the discovery surface.')
          return
        case 'account':
          navigate('/dev/vnext-account')
          return
        default:
          report(`Shell intent "${intent.kind}" — reported rather than routed.`)
      }
    },
    [navigate, report],
  )
}
