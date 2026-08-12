import { useEffect, useState } from 'react'
import type { SeasonLeagueMatchweekPredictions } from '../../services/supabase/seasonLeaguePredictionsModel'

/**
 * Contract 149's league matchweek predictions, read ONCE for a page rather than
 * once per surface that needs them.
 *
 * WHY IT WAS LIFTED. Two things on the Match Centre want the same payload: the
 * "Your leagues" section, which shows what co-members predicted, and the
 * `INNOV-001` projection, which needs their predictions to say what the next
 * goal would do to the table. Each fetching for itself would issue the same RPC
 * twice for every league on every fixture opened — an identical query repeated,
 * which the performance rules forbid, and two payloads that could answer the
 * reveal question differently if one failed.
 *
 * IT DECIDES NOTHING. The reveal boundary, the member rows, the cap and the
 * truncation flag are all the server's and arrive as given. This hook stores
 * them.
 *
 * EACH LEAGUE FAILS ALONE. One unreadable league leaves the others intact,
 * because a player in three leagues should not lose all three to one error.
 */

export type SeasonLeagueMatchweekState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; page: SeasonLeagueMatchweekPredictions }

export type SeasonLeagueMatchweekPages = Readonly<Record<string, SeasonLeagueMatchweekState>>

export type SeasonLeagueRef = { id: string; name: string }

export function useSeasonLeagueMatchweekPages(
  leagues: readonly SeasonLeagueRef[],
  competitionRoundId: string | null,
  load: (leagueId: string, competitionRoundId: string) => Promise<SeasonLeagueMatchweekPredictions>,
): SeasonLeagueMatchweekPages {
  const [pages, setPages] = useState<SeasonLeagueMatchweekPages>({})
  // Keyed on identity rather than the array: the caller rebuilds the list on
  // every render, and depending on the object would re-read on every render.
  const key = leagues.map((league) => league.id).join('|')

  useEffect(() => {
    if (!competitionRoundId || key === '') {
      setPages({})
      return
    }
    let active = true
    const ids = key.split('|')
    setPages(Object.fromEntries(ids.map((id) => [id, { kind: 'loading' as const }])))

    for (const id of ids) {
      void load(id, competitionRoundId).then(
        (page) => {
          if (active) setPages((current) => ({ ...current, [id]: { kind: 'ready', page } }))
        },
        () => {
          if (active) setPages((current) => ({ ...current, [id]: { kind: 'failed' } }))
        },
      )
    }

    return () => {
      active = false
    }
  }, [key, competitionRoundId, load])

  return pages
}
