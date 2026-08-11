import { useCallback, useEffect, useState } from 'react'
import { presentRivalWatch, type RivalWatch } from './rivalWatchModel'
import type { PlayerCompetitions } from './playerCompetitions'
import type { PlayerPreferences } from '../../services/supabase/playerPreferencesModel'
import { pinnedRivalsFor } from '../../services/supabase/playerPreferencesModel'

/**
 * The Hub's Rival Watch, assembled from a league table the player is already in.
 *
 * ONE COMPETITION AND ONE LEAGUE, AND THE BOUND IS STATED BY THE SURFACE. A
 * player relevant to twenty competitions must not make the Hub issue twenty
 * requests, so this covers the most relevant competition and the first private
 * league in it. Everything else lives in that competition's own leagues
 * section, which is one link away. A cap nobody can see reads as "we covered
 * everything" — the same rule the Matchweek Recap follows.
 *
 * IT ADDS NO READ OF ITS OWN. The comparison is a subtraction of two numbers
 * that are both in `get_league_members`' answer, so a rival needs the league
 * table and nothing further. Points and rank stay the league read's.
 *
 * IT FAILS QUIETLY, BECAUSE IT IS CONTEXT. Nobody opens the Hub to see Rival
 * Watch; a failed league read leaves the card absent rather than putting an
 * error where the football should be. The distinction that DOES matter — a
 * failed preference read — is the shell's, and it hands `preferences: null`,
 * which produces no card either.
 *
 * PINNING WRITES AND THEN RE-READS THE SHELL. `set_pinned_rival` is the
 * authority on who may be pinned (contract 151's shared-private-league
 * boundary), so a refusal must surface rather than being hidden behind an
 * optimistic local edit.
 */

const NO_WATCH: RivalWatchState = {
  status: 'idle',
  watch: null,
  competitionName: null,
  leagueName: null,
  tournamentId: null,
  pinError: null,
}

export type RivalWatchState = {
  status: 'idle' | 'loading' | 'ready'
  watch: RivalWatch | null
  competitionName: string | null
  leagueName: string | null
  tournamentId: string | null
  pinError: string | null
}

export function useRivalWatch(
  player: PlayerCompetitions | null,
  preferences: PlayerPreferences | null,
  reload: () => void,
) {
  const [state, setState] = useState<RivalWatchState>(NO_WATCH)

  // The most relevant competition the player actually plays a game in. A
  // followed competition with no game has no league table to compare inside.
  const target = (player?.mine ?? []).find(
    (entry) => entry.tournamentId !== null && entry.joinedGames.includes('main_predictor'),
  )
  const tournamentId = target?.tournamentId ?? null
  const gameCompetitionId =
    target?.games.find((game) => game.gameKey === 'main_predictor')?.id ?? null
  const pinnedKey = preferences ? pinnedRivalsFor(preferences, tournamentId).join('|') : ''

  useEffect(() => {
    if (!tournamentId || !gameCompetitionId || !preferences) {
      setState(NO_WATCH)
      return
    }
    let active = true
    setState({ ...NO_WATCH, status: 'loading' })
    void (async () => {
      try {
        const [{ fetchMyGameLeagues }, { fetchSeasonLeagueStandingsPage }] = await Promise.all([
          import('../../services/supabase/gameLeagues'),
          import('../../services/supabase/seasonLeagueStandings'),
        ])
        const leagues = await fetchMyGameLeagues(gameCompetitionId)
        const league = leagues[0]
        if (!league) {
          // No private league is a real, common state and not a failure: a
          // rival can only be somebody you share one with.
          if (active) setState({ ...NO_WATCH, status: 'ready' })
          return
        }
        const page = await fetchSeasonLeagueStandingsPage(league.id)
        if (!active) return
        setState({
          status: 'ready',
          watch: presentRivalWatch(page.rows, pinnedKey ? pinnedKey.split('|') : []),
          competitionName: target?.competition.name ?? null,
          leagueName: league.name,
          tournamentId,
          pinError: null,
        })
      } catch {
        // Context, not the reason the player is here.
        if (active) setState({ ...NO_WATCH, status: 'ready' })
      }
    })()
    return () => {
      active = false
    }
    // `target` is derived from `player` and changes with it; naming the two ids
    // and the pin list keeps the effect from re-running on every render.
  }, [tournamentId, gameCompetitionId, pinnedKey, preferences, target?.competition.name])

  const pin = useCallback(
    async (rivalUserId: string, pinned: boolean) => {
      if (!tournamentId) return
      setState((current) => ({ ...current, pinError: null }))
      try {
        const { setPinnedRival } = await import('../../services/supabase/playerPreferences')
        await setPinnedRival(tournamentId, rivalUserId, pinned)
        // The shell owns preferences; re-reading is what makes every other
        // surface agree with this one.
        reload()
      } catch {
        setState((current) => ({
          ...current,
          // The server's boundary, in the player's terms. It refuses anyone the
          // caller shares no private league with, which from this surface can
          // only mean the table changed under them.
          pinError: 'That did not save. They may no longer be in this league.',
        }))
      }
    },
    [reload, tournamentId],
  )

  return { ...state, pin }
}
