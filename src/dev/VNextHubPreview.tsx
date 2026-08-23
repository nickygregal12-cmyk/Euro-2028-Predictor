import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { PlayerCompetitionsProvider } from '../app/providers/PlayerCompetitionsProvider'
import { VNextRoot } from '../vnext/foundations/VNextRoot'
import { VNextShellElsewhereHost } from '../vnext/integration/shell/VNextShellElsewhereHost'
import { VNextHomeScreen } from '../vnext/integration/home/VNextHomeScreen'
import { VNextMatchesScreen } from '../vnext/integration/matches/VNextMatchesScreen'
import { VNextGamesScreen } from '../vnext/integration/games/VNextGamesScreen'
import { VNextLeaguesScreen } from '../vnext/integration/leagues/VNextLeaguesScreen'
import type { ShellDestinationId, ShellIntent } from '../vnext/models/shell'
import styles from './VNextHomePreview.module.css'

/**
 * THE FOUR DESTINATIONS UNDER ONE HOST — a `/dev` harness.
 *
 * ============================ WHAT THIS ONE PROVES =======================
 *
 * Every other vNext harness mounts ONE screen, which is the right shape for
 * reviewing that screen and the wrong shape for the only question the
 * cross-competition layer raises: does it survive a navigation?
 *
 * `useVNextShellElsewhere` costs a play-context read plus up to three game
 * reads PER COMPETITION. Mounted per page that is paid again every time a
 * player taps Matches; mounted once above the page it is paid once per player.
 * `VNextShellElsewhereHost` is where it is mounted, and this harness is where
 * that is actually exercised: the host and the provider beneath it stay mounted
 * while the four destinations swap under them.
 *
 * So this is the shape the production route host will have — one persistent
 * boundary, four pages beneath it — reachable now, before any route moves.
 *
 * ============================ IT MOVES NO ROUTE ==========================
 *
 * Behind `import.meta.env.DEV` at its import site in `App.tsx`, like every
 * other harness here. **The production Football Hub is untouched and nothing
 * about the cutover is decided by this file.** The destination switch is the
 * harness's own control, not a router: a real host answers a `ShellIntent` with
 * a navigation, and this one answers it with `useState`, which is exactly the
 * seam `VNextShellProvider` documents.
 *
 * ============================ THE GAMES DESTINATION WRITES ===============
 *
 * Pressing Join under this harness calls `join_competition_game` and really
 * enters this account into that game, because `VNextGamesScreen` owns the
 * write. The header below says so where a reviewer reads it before pressing.
 */
export function VNextHubPreview() {
  return (
    <AuthProvider>
      <PlayerCompetitionsProvider>
        <VNextRoot>
          <HubHarness />
        </VNextRoot>
      </PlayerCompetitionsProvider>
    </AuthProvider>
  )
}

type Destination = ShellDestinationId

const DESTINATIONS: readonly { readonly id: Destination; readonly label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'matches', label: 'Matches' },
  { id: 'games', label: 'Games' },
  { id: 'leagues', label: 'Leagues' },
]

function isDestination(value: string | null): value is Destination {
  return value === 'home' || value === 'matches' || value === 'games' || value === 'leagues'
}

function HubHarness() {
  const { userId, displayName, loading } = useAuth()
  const [params, setParams] = useSearchParams()
  const [note, setNote] = useState('')
  const [selectedLeagueId, setSelectedLeagueId] = useState<string | null>(null)
  const navigate = useNavigate()

  const competitionSlug = params.get('competition') ?? undefined
  const seasonSlug = params.get('season') ?? undefined
  // The Match Predictor's game competition id, which is what private leagues
  // hang off. Typed rather than derived, like every other harness here: the
  // point is to review a real season, not to reimplement how one is addressed.
  const gameCompetitionId = params.get('game')?.trim() || null
  const destinationParam = params.get('destination')
  const destination: Destination = isDestination(destinationParam) ? destinationParam : 'home'

  const go = useCallback(
    (next: Destination) => {
      const updated = new URLSearchParams(params)
      updated.set('destination', next)
      setParams(updated, { replace: true })
    },
    [params, setParams],
  )

  // THE HOST'S HALF OF THE INTENT SEAM. The shell says what the player asked
  // for; deciding what that means is the host's job and never the shell's.
  const onShellIntent = useCallback(
    (intent: ShellIntent) => {
      switch (intent.kind) {
        case 'destination':
          go(intent.destination)
          return
        case 'context':
          setNote(
            `Competition switch to ${intent.contextId} — a real host reloads the ` +
              'page reads for that competition; this harness reports it.',
          )
          return
        default:
          setNote(`Shell intent: ${intent.kind}`)
      }
    },
    [go],
  )

  return (
    <div className={styles.page}>
      <header className={styles.controls}>
        {/* An `h2`, not an `h1`. The shell below owns the page's single `<h1>`. */}
        <h2 className={styles.heading}>vNext Football Hub — four destinations, one host</h2>
        <p className={styles.note}>
          Development harness. <code>VNextShellElsewhereHost</code> is mounted
          ONCE, outside the destination switch, so the cross-competition inbox is
          read once per player rather than once per page. Switch destination and
          watch the network: the play-context and game reads do not repeat.
        </p>
        <p className={styles.note}>
          <strong>What to check:</strong> a one-competition player still gets the
          simple shape — no switcher, no attention layer, no Jump; a
          multi-competition player can switch context and the active competition
          appears once; work waiting in ANOTHER competition shows in attention
          and work waiting in THIS one does not; and a competition whose week
          fails to read hides none of the others.
        </p>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            const data = new FormData(event.currentTarget)
            const updated = new URLSearchParams()
            updated.set('competition', String(data.get('competition') ?? ''))
            updated.set('season', String(data.get('season') ?? ''))
            updated.set('game', String(data.get('game') ?? ''))
            updated.set('destination', destination)
            setParams(updated)
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
          <label className={styles.field}>
            <span>Game competition id</span>
            <input name="game" defaultValue={gameCompetitionId ?? ''} />
          </label>
          <button type="submit">Load</button>
        </form>
        <nav aria-label="Harness destination">
          {DESTINATIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={destination === entry.id}
              onClick={() => go(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        {note ? <p className={styles.note}>{note}</p> : null}
      </header>

      <VNextShellElsewhereHost>
        {destination === 'home' ? (
          <VNextHomeScreen
            userId={userId}
            displayName={displayName}
            authLoading={loading}
            competitionSlug={competitionSlug}
            seasonSlug={seasonSlug}
            gameCompetitionId={gameCompetitionId}
            playsLms={false}
            championshipCompetitionId={null}
            onShellIntent={onShellIntent}
          />
        ) : destination === 'matches' ? (
          <VNextMatchesScreen
            userId={userId}
            authLoading={loading}
            competitionSlug={competitionSlug}
            seasonSlug={seasonSlug}
            onShellIntent={onShellIntent}
          />
        ) : destination === 'games' ? (
          <VNextGamesScreen
            userId={userId}
            authLoading={loading}
            competitionSlug={competitionSlug}
            seasonSlug={seasonSlug}
            onShellIntent={onShellIntent}
            onIntent={(intent) => {
              if (intent.kind === 'open-game') {
                navigate(`/competitions/${competitionSlug ?? ''}/${seasonSlug ?? ''}/games`)
                return
              }
              if (intent.kind === 'create-private-play') {
                setNote('Create private play asked for — the corridor is a route.')
                return
              }
              // THE SCREEN PERFORMS IT. This only records that it was asked
              // for, so a reviewer can see the seam as well as the effect.
              setNote(`Join sent for game ${intent.gameId}.`)
            }}
          />
        ) : (
          <VNextLeaguesScreen
            userId={userId}
            authLoading={loading}
            competitionSlug={competitionSlug}
            seasonSlug={seasonSlug}
            gameCompetitionId={gameCompetitionId}
            selectedLeagueId={selectedLeagueId}
            gameName="Match Predictor"
            onShellIntent={onShellIntent}
            onIntent={(intent) => {
              if (intent.kind === 'scope') {
                setSelectedLeagueId(
                  intent.scope.kind === 'global' ? null : intent.scope.leagueId,
                )
                return
              }
              // The doorway to Stage 10's player profile. This harness reports
              // it rather than navigating, because opening a profile is a
              // different destination and this one is about the four.
              setNote(`Leagues intent: ${intent.kind}`)
            }}
          />
        )}
      </VNextShellElsewhereHost>
    </div>
  )
}
