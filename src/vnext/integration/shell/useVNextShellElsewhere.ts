import { useMemo } from 'react'
import { useGlobalPlayInbox } from '../../../features/hub/useGlobalPlayInbox'
import type { PlayerCompetitions } from '../../../features/hub/playerCompetitions'
import type { ShellSourceElsewhere } from './shellSource'

/**
 * ACQUISITION ONLY, FOR THE CROSS-COMPETITION HALF OF THE SHELL.
 *
 * The same four parts every adapter in this directory has, and the same split:
 * this file gets the answer and maps NOTHING. `buildShellAttention` is the
 * mapper and it is pure, so a story and a browser test can hand it a world.
 *
 * ============================ MOUNT IT ONCE, ABOVE THE PAGES ==============
 *
 * `useGlobalPlayInbox` issues one play-context read plus up to three game reads
 * PER COMPETITION the player is relevant to, concurrently and settled
 * independently. That is the right cost for a shell that is mounted once and
 * kept; it is the wrong cost for a page, and a host that called this from each
 * screen would pay it again on every navigation.
 *
 * So this hook exists to be called by ONE host — the thing that owns the shell
 * across route changes — which then passes its answer down as
 * `shellElsewhere`. Every screen's prop is optional and defaults to the
 * one-competition shape, so a page-scoped host is not obliged to buy it.
 *
 * ============================ IT NEVER GUESSES AT AN EMPTY INBOX ==========
 *
 * `inbox` is `null` until the loads settle, and `null` is NOT an empty inbox:
 * an empty one is the claim "nothing is waiting", which is exactly the claim a
 * player must not be given while the reads are still out. The attention layer
 * renders nothing in both cases, and the distinction still matters because they
 * are different sentences and only one of them is an answer.
 *
 * ============================ ONE COMPETITION FAILING IS NOT ALL OF THEM ==
 *
 * `useGlobalPlayInbox` settles each competition independently and names the
 * ones it could not read. The attention layer maps only the actions it was
 * given, so a competition whose week failed contributes no items and hides
 * none — which is `presentPlayInbox`'s own rule ("one unreadable competition
 * must not hide four readable ones") reaching the shell unchanged.
 */
export function useVNextShellElsewhere(
  player: PlayerCompetitions | null,
): ShellSourceElsewhere | null {
  const inbox = useGlobalPlayInbox(player)

  return useMemo(() => {
    if (player === null) return null

    return {
      // THE PLAYER'S OWN LIST, NEVER THE CATALOGUE. `mine` is follows unioned
      // with game membership; `catalogue` is every published season and is what
      // Explore is for. A shell built from the catalogue would put twenty
      // competitions in a three-competition player's product.
      competitions: player.mine.map((entry) => ({
        // `HubCompetition.tournamentId` is contract 147's `season_id` and is
        // non-null for every catalogue row, which is why `CompetitionRelevance`
        // can be addressed at all.
        tournamentId: entry.competition.tournamentId,
        name: entry.competition.name,
        seasonLabel: entry.competition.seasonLabel,
      })),
      inbox: inbox.status === 'ready' ? inbox.inbox : null,
    }
  }, [player, inbox])
}
