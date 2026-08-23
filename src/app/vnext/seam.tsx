import { useCallback, useEffect } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router'
import type { ReactNode } from 'react'
import { usePlayerCompetitions } from '../providers/PlayerCompetitionsProvider'
import { configureVNextTimeZone } from '../../vnext/foundations/format'
import { VNextShellElsewhereHost } from '../../vnext/integration/shell/VNextShellElsewhereHost'
import { VNextActionsHost } from '../../vnext/integration/actions/VNextActionsHost'
import type { ShellGameKey, ShellIntent } from '../../vnext/models/shell'
import type { VNextActionItem } from '../../vnext/models/actions'
import { viewerTimeZone } from '../../shared/time/kickoff'
import {
  competitionGameRoute,
  competitionRoute,
  competitionSectionRoute,
  type CompetitionRouteRef,
} from '../weeklyRoutes'

/**
 * WHAT EVERY CUTOVER ADAPTER SHARES.
 *
 * `src/app/vnext/` is the one door the production boundary suite admits, and
 * the adapters behind it all need the same three things: the viewer's zone, the
 * shell's intents as navigation, and the cross-competition read mounted once
 * above them. Written per adapter, those would be nine copies of one decision —
 * and the shell's own navigation is the last place a product can afford one of
 * them to drift.
 */

/**
 * POINT vNEXT'S FORMATTERS AT THE PLAYER, WHICH IS A CUTOVER OBLIGATION.
 *
 * `src/vnext/foundations/format.ts` pins `en-GB`/`Europe/London` so stories and
 * jsdom tests stay deterministic, and said in its own docblock that "real
 * integration will use the user's zone". This is real integration. Left pinned,
 * a surface that is mostly kickoff times would tell a player in Dublin, New
 * York or Sydney what time the match starts in London.
 *
 * Set in an effect rather than during render, because it is a side effect on
 * module state and a render must stay pure — and set on every mount, because a
 * viewer who changes their system zone gets it applied the next time they open
 * a vNext surface rather than on a full reload.
 */
export function useViewerFormatting(): void {
  useEffect(() => {
    configureVNextTimeZone(viewerTimeZone())
  }, [])
}

/** The game keys the shell names, as the addresses the router knows. */
const GAME_ROUTES: Readonly<Record<ShellGameKey, 'match-predictor' | 'lms' | 'championship'>> = {
  'match-predictor': 'match-predictor',
  'last-man-standing': 'lms',
  championship: 'championship',
}

/**
 * THE SHELL'S INTENTS, AS NAVIGATION.
 *
 * ============================ IT ANSWERS ALL FOUR NOW ====================
 *
 * The Matches-only version of this hook IGNORED a destination intent for Home,
 * Games or Leagues, and was right to: dropping a player from a vNext surface
 * into a legacy one mid-journey is the escape hatch the programme spent six
 * stages closing, and answering it silently would have made the shell's own
 * navigation the least trustworthy part of the new hub.
 *
 * The cutover is what removes that constraint. All four destinations are vNext
 * surfaces at their real addresses, so all four are answered, and the shell
 * finally navigates the product it is chrome for.
 *
 * ============================ IT INVENTS NO ADDRESS ======================
 *
 * Every route comes from `weeklyRoutes.ts`, which is the application's own
 * route authority. A template string built here would be a second opinion about
 * where a competition lives, and the first one to drift would be the one a
 * player pressed.
 *
 * ============================ AND NO COMPETITION EITHER ==================
 *
 * A `context`, `game` or `league` intent names a competition by its
 * `tournamentId`, which is an identity rather than an address. The mapping back
 * to slugs is the player's own competition list — the read the application
 * already mounts — so an intent naming a competition the player is not in
 * resolves to nothing and navigates nowhere, rather than being pasted into a
 * URL that would 404.
 */
/**
 * A COMPETITION IDENTITY, RESOLVED TO AN ADDRESS.
 *
 * Extracted so the shell's intents and the Action Centre's rows share ONE
 * mapping. A second copy would be a second answer to "where does this
 * tournament id live", and the two would drift the first time either grew a
 * rule — which is the same argument the codebase makes everywhere else about
 * one fact having one home.
 *
 * `null` in gives the competition the CURRENT ROUTE is about; a tournament id
 * the player holds no membership for gives `null` out, so a caller navigates
 * nowhere rather than pasting an unknown id into a URL that would 404.
 */
function useCompetitionRefResolver(): (contextId: string | null) => CompetitionRouteRef | null {
  const { competitionSlug, seasonSlug } = useParams()
  const { player } = usePlayerCompetitions()

  return useCallback(
    (contextId: string | null): CompetitionRouteRef | null => {
      if (contextId === null) {
        return competitionSlug === undefined || seasonSlug === undefined
          ? null
          : { competitionSlug, seasonSlug }
      }
      const entry = player?.mine.find((candidate) => candidate.tournamentId === contextId)
      const found = entry?.competition
      if (!found) return null
      return { competitionSlug: found.competitionSlug, seasonSlug: found.seasonSlug }
    },
    [player, competitionSlug, seasonSlug],
  )
}

export function useShellIntentNavigation(): (intent: ShellIntent) => void {
  const navigate = useNavigate()
  const refFor = useCompetitionRefResolver()

  return useCallback(
    (intent: ShellIntent) => {
      switch (intent.kind) {
        case 'discover':
          navigate('/competitions')
          return
        case 'account':
          navigate('/account')
          return
        case 'about':
          navigate('/about')
          return
        case 'destination': {
          const ref = refFor(intent.contextId)
          if (ref === null) return
          // Home is the competition's own address rather than a section of it,
          // which is the whole of the Competition Deck's merge: `/` and
          // `/competitions/:c/:s` are one visible destination.
          navigate(
            intent.destination === 'home'
              ? competitionRoute(ref)
              : competitionSectionRoute(ref, intent.destination),
          )
          return
        }
        case 'context': {
          // SWITCHING COMPETITION LANDS ON ITS HOME, not on the destination the
          // player happened to be looking at. Changing competition is changing
          // subject, and arriving on somebody else's Leagues table is a worse
          // answer than arriving at the front door.
          const ref = refFor(intent.contextId)
          if (ref !== null) navigate(competitionRoute(ref))
          return
        }
        case 'game': {
          const ref = refFor(intent.contextId)
          if (ref !== null) navigate(competitionGameRoute(ref, GAME_ROUTES[intent.game]))
          return
        }
        case 'league': {
          // A league is a SCOPE inside the Leagues destination rather than an
          // address of its own — Stage 9's finding, and the reason there is no
          // `/leagues/:id` here. The id travels as a query so the page opens on
          // that table and a refresh keeps it.
          const ref = refFor(intent.contextId)
          if (ref === null) return
          navigate(
            `${competitionSectionRoute(ref, 'leagues')}?league=${encodeURIComponent(intent.leagueId)}`,
          )
          return
        }
        default:
          return
      }
    },
    [navigate, refFor],
  )
}

/**
 * THE CROSS-COMPETITION READ, MOUNTED ONCE ABOVE THE FOUR DESTINATIONS.
 *
 * `useVNextShellElsewhere` says in its own header that it must be called by ONE
 * host above page navigation, because the inbox costs a play-context read plus
 * up to three game reads PER COMPETITION. A per-adapter host would pay that
 * again on every navigation between Home, Matches, Games and Leagues — the one
 * movement this product expects a player to make constantly.
 *
 * This closes the follow-up `docs/product/vnext-route-migration-matrix.md` §13
 * named when the Matches routes landed: *"what it does not yet do is SUPPLY the
 * attention, so until the seam is closed the production Matches route would
 * show a player nothing about the competitions they are not looking at."*
 */
/**
 * AN ACTION CENTRE ROW, AS NAVIGATION.
 *
 * ============================ WHY THE MODEL DOES NOT HOLD THIS ===========
 *
 * `VNextActionItem` carries `game` and `contextId` — what the row is about and
 * which competition it belongs to — and deliberately no URL. Which address a
 * game lives at is a routing fact, and the vNext lane must not hold one. This
 * is the same split `useGlobalPlayInbox` made when it resolved destinations
 * outside its model, and for the same reason: the Match Predictor's route
 * answers Not Found while its flag is off, so a model that had baked a link
 * would have been handing out dead ones.
 *
 * ============================ WORK GOES TO THE GAME, NEWS GOES HOME ======
 *
 * A row that NEEDS the player goes to the game, because the thing they owe is
 * on that game's current round and the game's route is exactly what shows it.
 *
 * `matchweek-settled` deliberately does NOT. It carries `settled_round_id` and
 * no route in this application takes a round id, so sending a player to the
 * Match Predictor would land them on the CURRENT matchweek — tapping
 * "Matchweek 11 is settled" and arriving at Matchweek 13's open card. The
 * competition's Home is where the recap and the since-you-were-here zones live,
 * which is the honest answer to "show me what happened".
 *
 * A `game-consequence` goes to the game it names, because survival and
 * elimination are that game's own state.
 *
 * ============================ AND A ROW MAY GO NOWHERE ===================
 *
 * `null` from either the game lookup or the competition resolver means the row
 * renders as plain information rather than as a control. That is the honest
 * outcome for an action in a competition the player's membership read did not
 * return, or for a `game_key` with no vNext surface — and `ActionCentreBody`
 * draws it as text rather than as a disabled button.
 */
export function useActionItemNavigation(): (item: VNextActionItem) => void {
  const navigate = useNavigate()
  const refFor = useCompetitionRefResolver()

  return useCallback(
    (item: VNextActionItem) => {
      const ref = refFor(item.contextId)
      if (ref === null) return

      if (item.kind === 'matchweek-settled') {
        navigate(competitionRoute(ref))
        return
      }

      if (item.game === null) return
      navigate(competitionGameRoute(ref, GAME_ROUTES[item.game]))
    },
    [navigate, refFor],
  )
}

export function VNextSeamHost({ children }: { children: ReactNode }) {
  return (
    <VNextShellElsewhereHost>
      {/* THE DURABLE ACTION FEED, MOUNTED BESIDE IT AND FOR A DIFFERENT REASON.
          The inbox above is the live cross-competition urgency layer; this is
          the server's own record of what needs the player and what has happened
          to them, with seen state that survives a change of device.

          The Football Hub cutover is why it is here at all. `vNextOwnsFrame`
          makes `AppShell` render no AppBar on a Hub destination, so
          `get_my_actions` — generated by five drivers and scheduled since
          contract 172 — had no reachable consumer in the production frame at
          all. It is mounted at the seam rather than per page because it is one
          read per player and a page-scoped host would repeat it on every
          navigation. */}
      <VNextActionsHostWithNavigation>{children}</VNextActionsHostWithNavigation>
    </VNextShellElsewhereHost>
  )
}

/**
 * The host with its rows made openable.
 *
 * A separate component because `useActionItemNavigation` reads the router, and
 * calling it in `VNextSeamHost` would put a hook above the boundary that
 * component is meant to be — the host is the thing mounted inside the route
 * tree, and this keeps the routing read where the routing is.
 */
function VNextActionsHostWithNavigation({ children }: { children: ReactNode }) {
  const openItem = useActionItemNavigation()
  return <VNextActionsHost onOpenItem={openItem}>{children}</VNextActionsHost>
}

/**
 * The same host, as a LAYOUT ROUTE.
 *
 * React Router only accepts `<Route>` as a child of `<Routes>`, so a provider
 * cannot simply be wrapped around a group of routes in the tree — it has to be
 * one. That is what this is: a route with no path whose element renders the
 * host around the `<Outlet />` its children resolve into.
 */
export function VNextSeamLayout() {
  return (
    <VNextSeamHost>
      <Outlet />
    </VNextSeamHost>
  )
}
