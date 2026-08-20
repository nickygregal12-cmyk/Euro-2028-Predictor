import { useCallback, useState } from 'react'
import { usePlayerCompetitions } from '../providers/PlayerCompetitionsProvider'
import { pinnedRivalsFor } from '../../services/supabase/playerPreferencesModel'

export type WatchedRivals = {
  /** Who the player is watching in this competition, in the server's order. */
  readonly watchedRivalIds: readonly string[]
  /** Start or stop watching somebody. Resolves once the shell has re-read. */
  readonly watch: (rivalUserId: string, watched: boolean) => Promise<void>
  /**
   * What the last attempt refused with, in the player's terms, or null.
   *
   * A REFUSAL MUST SURFACE. `set_pinned_rival` is the authority on who may be
   * watched — contract 151's shared-private-league boundary — so hiding a
   * failure behind an optimistic local edit would show a mark the server does
   * not hold, and it would come back next reload.
   */
  readonly watchError: string | null
}

const NOT_SIGNED_IN: WatchedRivals = {
  watchedRivalIds: [],
  watch: async () => {},
  watchError: null,
}

/**
 * WHO THIS PLAYER IS WATCHING IN THIS COMPETITION (contract 157).
 *
 * ============================ WHY IT LIVES AT THE SEAM ===================
 *
 * The preference is per COMPETITION and the shell already holds it: the
 * competitions provider reads it once for the whole application. A page-level
 * read would be a second copy of a preference that every surface has to agree
 * about, and the two would disagree for exactly as long as one of them had not
 * refreshed.
 *
 * ============================ THE WRITE RE-READS THE SHELL ===============
 *
 * There is no optimistic edit here, deliberately. `set_pinned_rival` decides
 * who may be watched, so the honest sequence is write, then ask the shell to
 * re-read, then let every surface render from the same answer. It costs a round
 * trip on a control nobody presses in a hurry.
 */
export function useWatchedRivals(
  competitionSlug: string | undefined,
  seasonSlug: string | undefined,
): WatchedRivals {
  const { player, preferences, reload } = usePlayerCompetitions()
  const [watchError, setWatchError] = useState<string | null>(null)

  const entry =
    !player || !competitionSlug || !seasonSlug
      ? undefined
      : player.mine.find(
          (candidate) =>
            candidate.competition.competitionSlug === competitionSlug &&
            candidate.competition.seasonSlug === seasonSlug,
        )
  const tournamentId = entry?.tournamentId ?? null

  const watch = useCallback(
    async (rivalUserId: string, watched: boolean) => {
      if (tournamentId === null) return
      setWatchError(null)
      try {
        const { setPinnedRival } = await import('../../services/supabase/playerPreferences')
        await setPinnedRival(tournamentId, rivalUserId, watched)
        reload()
      } catch {
        // The server's boundary, in the player's terms. It refuses anybody the
        // caller shares no private league with, which from a league table can
        // only mean the table changed under them.
        setWatchError('That did not save. They may no longer be in this league.')
      }
    },
    [reload, tournamentId],
  )

  if (!preferences) return { ...NOT_SIGNED_IN, watch, watchError }

  return {
    watchedRivalIds: pinnedRivalsFor(preferences, tournamentId),
    watch,
    watchError,
  }
}
