import type { CompetitionGameKey } from '../../services/supabase/competitionGamesModel'
import type { PlayerCompetitions } from '../hub/playerCompetitions'
import { favouriteFor, gamesFor, type OnboardingDraft } from './onboardingDraft'

/**
 * WHAT FINISHING SETUP ACTUALLY WRITES, IN THE ORDER IT WRITES IT.
 *
 * ============================ WHY IT IS A MODULE ========================
 *
 * It used to be the body of `OnboardingJourney.finish`, and while the legacy
 * journey was the only presentation of onboarding that was the right place for
 * it. It is not any more: `src/vnext/onboarding/` is a second presentation of
 * the same journey, and `src/vnext/integration/onboarding/VNextOnboardingScreen.tsx`
 * was deliberately written to EMIT AN INTENT and let its host commit — see its
 * header, and `src/vnext/models/onboarding.ts`, which both say the commit order
 * "lives in `OnboardingJourney` and this lane keeps no second copy of it".
 *
 * Cutting `/welcome` over to that presentation therefore had exactly two
 * options: copy the commit into the new host, or move it somewhere both hosts
 * call. A copy is how follows and game entries start disagreeing about what
 * "finished" means, so this is the second option. **The order, the failure
 * handling and the completion stamp below are unchanged** — this file is where
 * they now live, not a new opinion about them.
 *
 * ============================ THE THREE STEPS ===========================
 *
 *   1. FOLLOWS, including the favourite club named for each. Written at the
 *      end and in one pass rather than per tap: the player is still deciding,
 *      and a competition followed and unfollowed three times on the way to a
 *      decision should not be three round trips and three chances to half-fail.
 *
 *   2. GAME ENTRIES. A separate server authority and separately fallible — a
 *      registration window can close between choosing and finishing — so a
 *      refusal here is REPORTED and does not undo step 1.
 *
 *   3. COMPLETION. Onboarding is over either way. The server stamps completion
 *      once and never rewrites it, so a player who runs setup again later keeps
 *      the date they first finished.
 *
 * ============================ A REFUSAL IS NOT A FAILURE ================
 *
 * `partial` names exactly what did not go through and keeps everything that
 * did. Stranding somebody on a setup screen because a game filled up would be
 * the worst possible reading of "optional steps do not block entry". A thrown
 * error means the writes could not be attempted at all, and only the caller
 * can decide what to say about that.
 */

/** What a finished commit did. Never "some things did not save". */
export type OnboardingCommitOutcome =
  | { readonly kind: 'saved' }
  | { readonly kind: 'partial'; readonly refused: readonly string[] }

/**
 * The two writing modules, injectable.
 *
 * Production passes nothing and the dynamic imports below are used, which keeps
 * the Supabase clients off the critical path exactly as the journey did. A test
 * passes both and proves the ORDER — that a refused follow still lets the game
 * entries and the completion stamp run — without a network.
 */
export type OnboardingCommitWrites = {
  readonly setCompetitionFollow: (
    tournamentId: string,
    following: boolean,
    favouriteTeamId: string | null,
  ) => Promise<unknown>
  readonly registerBonusCompetition: (gameCompetitionId: string) => Promise<unknown>
  readonly setOnboardingProgress: (step: string, completed?: boolean) => Promise<unknown>
}

export type OnboardingCommitInput = {
  readonly draft: OnboardingDraft
  /**
   * The membership read, not merely the catalogue.
   *
   * A game entry is addressed by its `game_competition_id`, which belongs to
   * the served membership row — `HubGame` in the display catalogue carries the
   * game's key and its presentation and no id at all. A missing id is reported
   * as a refused game rather than guessed, because a join sent to anything else
   * would be a join to a competition nobody chose.
   */
  readonly player: PlayerCompetitions
  readonly writes?: OnboardingCommitWrites | undefined
}

async function resolveWrites(
  supplied: OnboardingCommitWrites | undefined,
): Promise<OnboardingCommitWrites> {
  if (supplied) return supplied
  const [preferences, bonus] = await Promise.all([
    import('../../services/supabase/playerPreferences'),
    import('../../services/supabase/bonusGames'),
  ])
  return {
    setCompetitionFollow: preferences.setCompetitionFollow,
    registerBonusCompetition: bonus.registerBonusCompetition,
    setOnboardingProgress: preferences.setOnboardingProgress,
  }
}

export async function commitOnboarding(
  input: OnboardingCommitInput,
): Promise<OnboardingCommitOutcome> {
  const { draft, player } = input
  const byName = new Map(player.catalogue.map((entry) => [entry.seasonRowName, entry]))
  const refused: string[] = []

  const writes = await resolveWrites(input.writes)

  for (const key of draft.followed) {
    const competition = byName.get(key)
    if (!competition) continue
    try {
      await writes.setCompetitionFollow(competition.tournamentId, true, favouriteFor(draft, key))
    } catch {
      refused.push(`Following ${competition.name}`)
    }
  }

  for (const key of draft.followed) {
    const competition = byName.get(key)
    if (!competition) continue
    for (const gameKey of gamesFor(draft, key)) {
      const served = competition.games.find((game) => game.gameKey === gameKey)
      if (!served || served.joined) continue
      const gameCompetitionId = servedCompetitionId(player, key, gameKey)
      if (!gameCompetitionId) {
        refused.push(`${served.name} in ${competition.name}`)
        continue
      }
      try {
        await writes.registerBonusCompetition(gameCompetitionId)
      } catch {
        refused.push(`${served.name} in ${competition.name}`)
      }
    }
  }

  await writes.setOnboardingProgress('review', true)

  return refused.length > 0 ? { kind: 'partial', refused } : { kind: 'saved' }
}

/**
 * The `game_competition_id` a join is addressed by, for one competition and one
 * game. It comes from the membership read and is never constructed.
 */
function servedCompetitionId(
  player: PlayerCompetitions,
  seasonRowName: string,
  gameKey: CompetitionGameKey,
): string | null {
  const relevance = player.mine.find(
    (entry) => entry.competition.seasonRowName === seasonRowName,
  )
  return relevance?.games.find((game) => game.gameKey === gameKey)?.id ?? null
}
