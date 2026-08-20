import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextGamesScreen } from '../vnext/integration/games/VNextGamesScreen'
import type { ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * vNEXT GAMES AGAINST REAL DATA — a `/dev` harness.
 *
 * ============================ WHAT IT IS FOR ============================
 *
 * The deterministic worlds in Storybook are the review surface. This is where
 * the catalogue meets a real season, and there are two facts worth confirming
 * against one:
 *
 *   A. does `server_now` actually arrive? Every registration state on this page
 *      resolves against it, and the fallback to the host clock is a path that
 *      should never be taken in practice;
 *   B. does any game arrive with a null `display_name`? The surface refuses to
 *      build a title from the key, so that row reads differently, and it is
 *      worth knowing whether real catalogues produce it.
 *
 * ============================ IT WRITES. PRESSING JOIN REALLY JOINS =====
 *
 * The join is wired: `VNextGamesScreen` calls `join_competition_game` through
 * its acquisition hook, so pressing Join in this harness ENTERS THE PLAYER
 * INTO A REAL GAME in a real season. That is the point — a control nothing
 * performs cannot be proved end to end — and it is why the header below says
 * so where a reviewer will read it before pressing, on the same terms
 * `/dev/vnext-lms` and `/dev/vnext-discovery` state their own writes.
 *
 * ============================ IT IS `/dev` AND NOT A ROUTE ==============
 *
 * Behind `import.meta.env.DEV` at its import site in `App.tsx`. THE PRODUCTION
 * GAMES SURFACES ARE UNTOUCHED.
 */
export function VNextGamesPreview() {
  return (
    <AuthProvider>
      <VNextRoot>
        <GamesHarness />
      </VNextRoot>
    </AuthProvider>
  )
}

function GamesHarness() {
  const { userId, loading } = useAuth()
  const [params, setParams] = useSearchParams()
  const [note, setNote] = useState('')
  const onShellIntent = useShellIntentHost(setNote)
  const navigate = useNavigate()

  const competitionSlug = params.get('competition') ?? undefined
  const seasonSlug = params.get('season') ?? undefined

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* AN `h2`, NOT AN `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Games — real data</h2>
        <p className={styles.note}>
          Development harness. Reads <code>get_competition_games</code> for one
          season and renders the Stage 13 hub unchanged. Not a product route —
          but <strong>it writes</strong>: pressing Join calls{' '}
          <code>join_competition_game</code> and really enters this account into
          that game.
        </p>
        <p className={styles.note}>
          <strong>Worth checking against a real season:</strong> that{' '}
          <code>server_now</code> arrives — every registration state resolves
          against it — and whether any game arrives without a{' '}
          <code>display_name</code>, which this surface refuses to invent from
          the game key. And that a Join lands: the row should become “You are
          playing” from the RE-READ, and a refused one should leave the row
          alone and print the server's own sentence beneath it.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            setParams({
              competition: String(data.get('competition') ?? ''),
              season: String(data.get('season') ?? ''),
            })
          }}
        >
          <label className={styles.field}>
            <span>Competition slug</span>
            <input name="competition" defaultValue={competitionSlug ?? ''} />
          </label>
          <label className={styles.field}>
            <span>Season key</span>
            <input name="season" defaultValue={seasonSlug ?? ''} />
          </label>
          <button type="submit">Load</button>
        </form>
        {note ? <p className={styles.note}>{note}</p> : null}
      </header>

      <VNextGamesScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (intent.kind === 'open-game') {
            navigate(
              `/competitions/${competitionSlug ?? ''}/${seasonSlug ?? ''}/games`,
            )
            return
          }
          if (intent.kind === 'create-private-play') {
            setNote('Create private play asked for — the corridor is a route.')
            return
          }
          // THE SCREEN PERFORMS IT. This only records that it was asked for,
          // so a reviewer can see the seam as well as the effect.
          setNote(`Join sent for game ${intent.gameId}.`)
        }}
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
          navigate('/competitions')
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
