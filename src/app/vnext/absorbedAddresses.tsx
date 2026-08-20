import { Navigate, useParams } from 'react-router'
import type { ReactElement } from 'react'
import { usePlayerCompetitions } from '../providers/PlayerCompetitionsProvider'
import { RouteFallback } from '../RouteFallback'
import { useSite } from '../site/SiteProvider'
import {
  competitionRoute,
  competitionSectionRoute,
  weeklyRoutes,
  type CompetitionSection,
} from '../weeklyRoutes'

/**
 * THE ADDRESSES vNEXT ABSORBED, RESOLVED TO WHERE THEIR JOB WENT.
 *
 * ============================ WHAT THIS FINISHES ========================
 *
 * `docs/product/vnext-route-migration-matrix.md` gave each of these a fate and
 * deliberately stopped short of acting on it — "existing URLs and the visible
 * mental model are different concerns, and this document is only about the
 * first", with the technical half left to "the production cutover stage". Stage
 * 14 cut the DESTINATIONS over and left the absorbed addresses rendering their
 * legacy pages, so `/play`, `/matches`, `/leagues`, `/more`, `/more/scoring`
 * and `/profile` stayed as a complete parallel product in the retired design,
 * one press away from anything that still linked to them.
 *
 * They are not dead ends and they are not deleted. Each RESOLVES to the surface
 * that absorbed its job, so every bookmark, shared link and old email keeps
 * working and lands somewhere that is the same application the player was
 * already in.
 *
 * ============================ THREE RULES, AND THEY ARE ALL RESTRAINTS ==
 *
 *   1. GATED ON THE ABSORBING DESTINATION'S OWN FLAG. `/matches` resolves into
 *      the competition's Matches only where `footballHubMatches` is on, so
 *      rolling that destination back restores the old global page WITH it. A
 *      redirect that survived its own target's rollback would strand a player
 *      at a legacy destination they can no longer reach the vNext one from.
 *
 *   2. HUB ONLY. Three of these are `variantRoutes.ts`'s shared paths and mean
 *      the tournament's own product on the Euro build; the other three are
 *      served there too. Euro 2028 is explicitly outside this migration, so a
 *      build that does not serve the domestic tree keeps every one of these
 *      addresses exactly as it had them.
 *
 *   3. NO ADDRESS IS CONSTRUCTED HERE. Every target comes from
 *      `weeklyRoutes.ts`, and which competition is active comes from
 *      `player.mine[0]` — "most relevant first", the same server-derived
 *      ordering `VNextRootDestination` resolves `/` by and the navigation rail
 *      already trusts. A second opinion about either would be the one a player
 *      pressed.
 *
 * ============================ AND A FAILED READ IS NOT A ROLLBACK =======
 *
 * The same reasoning `VNextRootDestination` records: the rollback is the flag
 * and it is build-time, so a flaky membership read must not move a player
 * between two information architectures. Both failure states land on Discovery,
 * which asserts nothing about membership.
 */

/** Where a section-scoped absorption resolves to, once membership answers. */
type Resolution =
  | { readonly kind: 'waiting' }
  | { readonly kind: 'go'; readonly href: string }

/**
 * The active competition's own address for one section.
 *
 * `home` is the competition's front door rather than a section of it, which is
 * the whole of the Competition Deck's merge — `/` and `/competitions/:c/:s` are
 * one visible destination.
 */
function useAbsorbedTarget(section: CompetitionSection): Resolution {
  const { status, player } = usePlayerCompetitions()

  if (status === 'loading') return { kind: 'waiting' }
  if (status === 'failed' || player === null) {
    return { kind: 'go', href: weeklyRoutes.competitions }
  }

  const first = player.mine[0]
  if (first === undefined) return { kind: 'go', href: weeklyRoutes.competitions }

  const ref = {
    competitionSlug: first.competition.competitionSlug,
    seasonSlug: first.competition.seasonSlug,
  }
  return {
    kind: 'go',
    href: section === 'overview' ? competitionRoute(ref) : competitionSectionRoute(ref, section),
  }
}

type AbsorbedProps = {
  readonly section: CompetitionSection
  /**
   * What this build serves at the address when the absorption does not apply —
   * the deployment is not the Hub, or the absorbing destination is rolled back.
   * An ELEMENT rather than a component, so the caller keeps the `<X />` shape
   * the source sweeps in `tests/app/` read.
   */
  readonly legacy: ReactElement
}

function Absorbed({ section, legacy }: AbsorbedProps): ReactElement {
  const site = useSite()
  const target = useAbsorbedTarget(section)

  if (!site.servesDomesticCompetitions) return legacy
  if (target.kind === 'waiting') return <RouteFallback />
  return <Navigate to={target.href} replace />
}

/**
 * `/play` — the cross-competition action inbox.
 *
 * The matrix settled this one first and hardest: *"the job splits in two and
 * both halves have a home: what needs doing HERE is Home's, and what needs
 * doing ELSEWHERE is the shell's secondary attention layer. Neither is a
 * destination. The word `Play` therefore leaves the navigation entirely."* Home
 * is the half that has an address, so this resolves there.
 */
export function VNextPlayAbsorbed({ legacy }: { legacy: ReactElement }): ReactElement {
  return <Absorbed section="overview" legacy={legacy} />
}

/**
 * `/matches` — one chronological calendar across the player's competitions.
 *
 * ABSORBED RATHER THAN RETIRED, and the distinction is load-bearing: the
 * cross-competition calendar still exists, as `MatchesScope: 'combined'` inside
 * the competition's Matches destination, where every fixture names its own
 * competition. Contract 197 was written for exactly that. What went is the
 * fifth primary destination, not the football.
 */
export function VNextMatchesAbsorbed({ legacy }: { legacy: ReactElement }): ReactElement {
  return <Absorbed section="matches" legacy={legacy} />
}

/**
 * `/leagues` — all private play across every competition.
 *
 * Stage 9 settled this on a DATA argument rather than a navigation one: a
 * cross-competition people surface would rank players across competitions they
 * do not share, which ADR 0011 refuses at the data layer. The job that survives
 * — naming a league's game and its competition — survives inside the
 * competition-scoped surface, where the header names both, and the shell's
 * switcher is how a player reaches another competition's leagues.
 */
export function VNextLeaguesAbsorbed({ legacy }: { legacy: ReactElement }): ReactElement {
  return <Absorbed section="leagues" legacy={legacy} />
}

/**
 * `/more/scoring` — how the games work.
 *
 * *"Rules belong beside the game they govern."* `VNextGames` renders
 * `VNextGameRules` for the competition's own games, so the rules are a section
 * of Games rather than a page reached from a directory.
 */
export function VNextScoringAbsorbed({ legacy }: { legacy: ReactElement }): ReactElement {
  return <Absorbed section="games" legacy={legacy} />
}

/**
 * `/more` and `/profile` — the directory, and platform identity.
 *
 * NEITHER NEEDS THE MEMBERSHIP READ, because neither resolves to a competition:
 * the account is the platform's. `/more` was three link rows — Account, Profile
 * and How the games work — every one of which is now somewhere else, and *"a
 * directory page is a symptom of a navigation that ran out of slots"*. `/profile`
 * is platform identity and season history, and contracts 157 and 161 are both
 * read by the vNext Account surface, which is where the matrix sends the three
 * profile systems rather than adding a fourth.
 */
export function VNextAccountAbsorbed({ legacy }: { legacy: ReactElement }): ReactElement {
  const site = useSite()
  if (!site.servesDomesticCompetitions) return legacy
  return <Navigate to="/account" replace />
}

/**
 * `/competitions/:c/:s/play` — the competition-scoped action list.
 *
 * The same argument as `/play`, one level down: *"two 'what needs doing'
 * surfaces at two scopes is one too many."* It needs no membership read either,
 * because the competition is in the address already — which is why it takes the
 * route parameters rather than resolving an active competition that might not
 * be the one the player typed.
 */
export function VNextCompetitionPlayAbsorbed({
  legacy,
}: {
  readonly legacy: ReactElement
}): ReactElement {
  const site = useSite()
  const { competitionSlug, seasonSlug } = useParams()
  if (!site.servesDomesticCompetitions) return legacy
  if (competitionSlug === undefined || seasonSlug === undefined) return legacy
  return <Navigate to={competitionRoute({ competitionSlug, seasonSlug })} replace />
}

/**
 * `…/games/match-predictor/standings` — how am I doing against the field.
 *
 * *"A game's standings and a private league's table answer the same question at
 * two scopes."* Stage 9 built both as SCOPES inside one Leagues surface,
 * because the two have different rank authorities and neither is a filter of
 * the other — so the season table is not lost, it is the default scope of the
 * destination this resolves to. It takes the competition from the address for
 * the same reason the one above does.
 */
export function VNextStandingsAbsorbed({
  legacy,
}: {
  readonly legacy: ReactElement
}): ReactElement {
  const site = useSite()
  const { competitionSlug, seasonSlug } = useParams()
  if (!site.servesDomesticCompetitions) return legacy
  if (competitionSlug === undefined || seasonSlug === undefined) return legacy
  return (
    <Navigate
      to={competitionSectionRoute({ competitionSlug, seasonSlug }, 'leagues')}
      replace
    />
  )
}
