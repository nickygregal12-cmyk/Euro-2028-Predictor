import { Navigate } from 'react-router'
import { usePlayerCompetitions } from '../providers/PlayerCompetitionsProvider'
import { RouteFallback } from '../RouteFallback'
import { competitionRoute, weeklyRoutes } from '../weeklyRoutes'

/**
 * WHAT `/` OPENS ON, WHICH IS THE ONE THING STAGE 14 LEFT UNDECIDED.
 *
 * ============================ THE DECISION IT IMPLEMENTS ==================
 *
 * `docs/product/vnext-shell-ia.md` selected Concept A, the Competition Deck,
 * and stated the mental model in one sentence: *"I am inside a football
 * competition. Everything beneath the shell belongs to that competition until I
 * deliberately change it."* The route matrix's `/` row then said `/` and
 * `/competitions/:c/:s` are ONE visible destination — and deferred exactly one
 * question to this stage, in these words:
 *
 *   > `/` may keep resolving to whatever the player's active competition is,
 *   > AND DECIDING HOW IS THE CUTOVER STAGE'S WORK.
 *
 * Reviewed against the alternative at 375 and 1440 in
 * `src/vnext/stories/RootResolution.stories.tsx` and decided by the repository
 * owner on 20 August 2026: **the player arrives inside a competition.** The
 * candidate that asked first was refuted by its own render — on a desktop frame
 * the rail already lists the player's competitions, so the page repeated its
 * own chrome; on a phone it spent a press and showed no football.
 *
 * ============================ WHICH COMPETITION, AND WHY THAT ONE =========
 *
 * `player.mine` is documented in `src/features/hub/playerCompetitions.ts` as
 * "the competitions this player is relevant to, MOST RELEVANT FIRST" — a
 * server-derived ordering the platform already computes and already trusts for
 * the navigation rail's shortcuts. So the first entry is the answer, and this
 * file adds no ordering of its own.
 *
 * IT IS DELIBERATELY NOT RECENCY. `vnext-shell-ia.md` §7 omitted "recently
 * viewed" on evidence — Stage 7.5's audit "found no per-competition recency
 * authority anywhere in the platform", and `VNextShellModel` carries no recency
 * field so that a surface wanting to draw fictional history would have to add
 * the type first. Resolving `/` by recency would be that same invention wearing
 * a router's clothes. §7 also names the sanctioned way to add stickiness later:
 * "a small local presentation preference — four to six competition ids,
 * convenience only, never membership". That remains available and additive, and
 * nothing here forecloses it.
 *
 * IT IS NOT A FAVOURITE EITHER. In `playerCompetitions.ts` a favourite is a
 * favourite CLUB within a competition — "presentation prominence only" — so it
 * cannot name a competition without being redefined.
 *
 * ============================ WHY IT REDIRECTS ============================
 *
 * So that Home has exactly ONE canonical address. `useShellIntentNavigation`
 * already answers a `home` destination intent with `competitionRoute(ref)`, so
 * a `/` that rendered Home in place would give the same screen two URLs that
 * disagree after a switch, a refresh or a share. `/` stays a working address
 * and becomes an entry point rather than a second home.
 *
 * ============================ AND WHY A FAILED READ IS NOT A ROLLBACK =====
 *
 * The first version of this route rendered the LEGACY hub when the membership
 * read failed, reasoning that the front door should fail closed. That was wrong
 * twice.
 *
 * It was wrong about the mechanism: the ROLLBACK is the flag, and it is a
 * build-time one. A transient read failure is not a decision to serve
 * yesterday's product, and treating it as one means a player can be moved
 * between two information architectures by a flaky network.
 *
 * And it was wrong about what a player saw. `/` sits inside `AppShell`, so
 * keeping a legacy element reachable here meant this address could not
 * surrender the legacy frame — which made every ordinary arrival paint the
 * retired masthead and its five-tab bar for the length of the membership read
 * and then replace it. The rare path cost the common one a visible flash of the
 * product the cutover exists to retire.
 *
 * Both failure states therefore go to Discovery, which is a real surface for
 * "no competition resolved here" and asserts NOTHING about membership — the
 * shell's own copy is "No competition selected", which the switcher's docblock
 * already establishes is a statement about the page rather than the player. The
 * provider still keeps "in none" and "could not find out" apart, and that
 * distinction still matters to surfaces that report it; it does not change what
 * this route can usefully do, and pretending otherwise would put a second
 * opinion about a failed read into the router.
 */
export function VNextRootDestination() {
  const { status, player } = usePlayerCompetitions()

  if (status === 'loading') return <RouteFallback />
  if (status === 'failed' || player === null) {
    return <Navigate to={weeklyRoutes.competitions} replace />
  }

  const first = player.mine[0]

  // NO COMPETITION IS NOT AN ERROR AND MUST NOT LOOK LIKE ONE. There is nothing
  // to resolve `/` to, and a Home for a competition the player is not in would
  // be an empty room with their name on it. Discovery is the honest arrival,
  // and the shell already states the case in its own chrome: "No competition
  // selected — Explore what is published and pick one".
  if (first === undefined) return <Navigate to={weeklyRoutes.competitions} replace />

  return (
    <Navigate
      to={competitionRoute({
        competitionSlug: first.competition.competitionSlug,
        seasonSlug: first.competition.seasonSlug,
      })}
      replace
    />
  )
}
