import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { catalogueFromPublishedSeasons } from '../../features/hub/competitionCatalogue'
import {
  presentPlayerCompetitions,
  type PlayerCompetitions,
} from '../../features/hub/playerCompetitions'

/**
 * Which competitions matter to the signed-in player, read once for the shell.
 *
 * WHY IT IS A PROVIDER. Four surfaces need the same answer — the navigation
 * rail, and the three global destinations that stopped being competition
 * choosers — and before this each one issued its own `fetchHubMembership`. Four
 * copies of one read is four chances to disagree about which competitions a
 * player has, and on a platform of twenty competitions it is also four times
 * the request.
 *
 * IT IS NOT A MEMBERSHIP AUTHORITY. It caches one read of the server's answer
 * and hands it to presentation. Every join, leave, lock and score still belongs
 * to the server; `reload` exists because a surface that changes membership must
 * be able to make the shell agree with what it just did.
 *
 * FAILURE IS A STATE, NOT AN EMPTY LIST. "You are in no competitions" and "we
 * could not find out" send a player to different places, so the two are
 * distinct here and every consumer is expected to render them differently.
 *
 * IT MOUNTS INSIDE THE SIGNED-IN SHELL ONLY. A signed-out visitor has no
 * membership to read, and the landing page must not issue an authenticated
 * request to render.
 *
 * THE SUPABASE READ IS IMPORTED LAZILY, INSIDE THE EFFECT. Importing it at
 * module scope pulls `services/supabase/client` — which throws at module load
 * without configuration — into the graph of everything that renders the shell,
 * including the competition masthead's switcher. That turned a presentational
 * component into one that could not be rendered in a test or a harness without
 * credentials, which is the seam the architecture rule about components and
 * Supabase exists to keep clean.
 */

export type PlayerCompetitionsState = {
  status: 'loading' | 'ready' | 'failed'
  /**
   * Null while loading or after a failure. Never an empty model standing in
   * for an unknown one.
   */
  player: PlayerCompetitions | null
  reload: () => void
}

const PlayerCompetitionsContext = createContext<PlayerCompetitionsState | null>(null)

export function PlayerCompetitionsProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [player, setPlayer] = useState<PlayerCompetitions | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setStatus('loading')
    void (async () => {
      try {
        const [{ fetchHubMembership }, { fetchPublishedWeeklySeasons }] = await Promise.all([
          import('../../services/supabase/competitionGames'),
          import('../../services/supabase/weeklyCatalogue'),
        ])
        // WHICH SEASONS EXIST, AND WHERE EACH ONE LIVES, both come from the
        // server (contract 147, closing `MIG-UI-12`). There is no static
        // competition array left to merge in: publishing a league on the server
        // is the whole of making it exist and making it routable.
        const published = await fetchPublishedWeeklySeasons()
        const seasons = await fetchHubMembership(published.map((season) => season.seasonName))
        if (!active) return
        setPlayer(
          presentPlayerCompetitions(
            catalogueFromPublishedSeasons(published, seasons),
            seasons,
          ),
        )
        setStatus('ready')
      } catch {
        if (!active) return
        // The previous answer is discarded rather than left on screen: a rail
        // that keeps showing a competition after the read that proved it failed
        // is asserting membership nothing confirmed.
        setPlayer(null)
        setStatus('failed')
      }
    })()
    return () => {
      active = false
    }
  }, [nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])
  const value = useMemo<PlayerCompetitionsState>(
    () => ({ status, player, reload }),
    [status, player, reload],
  )

  return (
    <PlayerCompetitionsContext.Provider value={value}>
      {children}
    </PlayerCompetitionsContext.Provider>
  )
}

/**
 * Read the shell's answer.
 *
 * Returns a loading state rather than throwing when no provider is mounted, so
 * a component gallery or a unit test can render a consumer without one. A
 * missing provider is a development mistake that shows as a permanent skeleton,
 * which is louder than a silent empty list and quieter than a crashed route.
 */
export function usePlayerCompetitions(): PlayerCompetitionsState {
  return (
    useContext(PlayerCompetitionsContext) ?? {
      status: 'loading',
      player: null,
      reload: () => {},
    }
  )
}
