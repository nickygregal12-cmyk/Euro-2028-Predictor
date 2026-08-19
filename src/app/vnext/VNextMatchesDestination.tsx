import { useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { configureVNextTimeZone } from '../../vnext/foundations/format'
import { VNextRoot } from '../../vnext/foundations/VNextRoot'
import { VNextMatchesScreen } from '../../vnext/integration/matches/VNextMatchesScreen'
import { VNextMatchCentreScreen } from '../../vnext/integration/matches/VNextMatchCentreScreen'
import type { ShellIntent } from '../../vnext/models/shell'
import { viewerTimeZone } from '../../shared/time/kickoff'
import { competitionSectionRoute, competitionMatchCentreRoute } from '../weeklyRoutes'

/**
 * THE vNEXT MATCHES SURFACES, AT THEIR REAL ADDRESSES.
 *
 * ============================ WHAT THIS IS, AND IS NOT ====================
 *
 * Stage 8 built the surfaces and `src/dev/VNextMatchesPreview.tsx` proved they
 * can be fed from the real database. Neither of those is a production route,
 * and the gap between the harness and a route is exactly two things:
 *
 *   1. the harness gets the competition and season from a FORM; a route gets
 *      them from `useParams`, and must behave when they are absent;
 *   2. the harness REPORTS an intent into a paragraph; a route has to turn it
 *      into a URL, because a destination the player cannot link to or press
 *      "back" out of is not a destination.
 *
 * This module is that adapter and nothing else. It contains no reads, no
 * mapping and no presentation: the screens already own all three. If a rule
 * about matches appears here, it is in the wrong file.
 *
 * ============================ WHY IT LIVES IN `src/app` ==================
 *
 * `tests/vnext/vnextProductionBoundary.test.ts` forbids a vNext presentation
 * module from importing `/src/features/`, and this file imports `AuthProvider`
 * and the application's route helpers. That is not a loophole — it is the
 * direction the boundary is drawn in. The application may know about vNext;
 * vNext may not know about the application. Putting the adapter inside
 * `src/vnext/` would invert that and the boundary test would say so.
 *
 * ============================ THE FIXTURE ID IS THE WHOLE LINK ===========
 *
 * `onIntent` receives `openMatch` carrying a canonical fixture id and nothing
 * else, and turns it into the Match Centre address. Contract 148 resolves a
 * fixture from that id alone — no date, no window, no competition — so the
 * address the player lands on survives a refresh, a share and a bookmark. The
 * competition and season stay in the path because the route pattern owns them,
 * not because the read needs them.
 */
export function VNextMatchesDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug } = useParams()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const onShellIntent = useShellIntentNavigation()

  return (
    <VNextRoot>
      <VNextMatchesScreen
        userId={userId}
        authLoading={loading}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (intent.kind !== 'openMatch') return
          if (competitionSlug === undefined || seasonSlug === undefined) return
          navigate(
            competitionMatchCentreRoute({ competitionSlug, seasonSlug }, intent.matchId),
          )
        }}
      />
    </VNextRoot>
  )
}

/**
 * The Match Centre, addressed by its fixture.
 *
 * `competitionSlug` and `seasonSlug` are passed through even though contract
 * 148 does not need them, because the SCREEN uses them for the way back —
 * "Back to Matches" has to name a competition even when the fixture read
 * could resolve without one.
 */
export function VNextMatchCentreDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug, fixtureId } = useParams()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const onShellIntent = useShellIntentNavigation()

  return (
    <VNextRoot>
      <VNextMatchCentreScreen
        userId={userId}
        authLoading={loading}
        fixtureId={fixtureId ?? ''}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (intent.kind !== 'link' || intent.link !== 'competition-matches') return
          if (competitionSlug === undefined || seasonSlug === undefined) return
          navigate(competitionSectionRoute({ competitionSlug, seasonSlug }, 'matches'))
        }}
      />
    </VNextRoot>
  )
}

/**
 * POINT vNEXT'S FORMATTERS AT THE PLAYER, WHICH IS A CUTOVER OBLIGATION.
 *
 * `src/vnext/foundations/format.ts` pins `en-GB`/`Europe/London` so that
 * stories and jsdom tests are deterministic, and said in its own docblock that
 * "real integration will use the user's zone". This is real integration. Left
 * pinned, Matches — a surface that is almost entirely kickoff times — would
 * tell a player in Dublin, New York or Sydney what time the match starts in
 * London.
 *
 * `tests/app/kickoffFormattingAuthority.test.ts` is what surfaced it, and only
 * once the route wiring put a vNext module in the shipping graph. It had been
 * true and invisible for six stages.
 *
 * Set in an effect rather than during render, because it is a side effect on
 * module state and a render must stay pure — and set on every mount, because a
 * viewer who changes their system zone gets it applied the next time they open
 * a vNext surface rather than on a full reload.
 */
function useViewerFormatting() {
  useEffect(() => {
    configureVNextTimeZone(viewerTimeZone())
  }, [])
}

/**
 * THE SHELL'S INTENTS, AS NAVIGATION.
 *
 * The harness reported most of these into a paragraph because it had nowhere
 * to send them. A route does, for the two that are already migrated or already
 * legacy-addressable — and DELIBERATELY NOT for the rest.
 *
 * A destination intent for Games or Leagues is IGNORED rather than routed to
 * the legacy page. Dropping a player from a vNext surface into a legacy one
 * mid-journey is the "escape hatch" the programme has been closing stage by
 * stage; doing it silently here would reopen it at the moment of cutover, and
 * would make the shell's own navigation the least trustworthy part of the new
 * hub. Those destinations get their behaviour when their own flag does.
 */
function useShellIntentNavigation() {
  const navigate = useNavigate()
  const { competitionSlug, seasonSlug } = useParams()
  return useCallback(
    (intent: ShellIntent) => {
      switch (intent.kind) {
        case 'discover':
          navigate('/competitions')
          return
        case 'account':
          navigate('/account')
          return
        case 'destination':
          // Matches is the only migrated destination, so it is the only one
          // this adapter may answer. Everything else waits for its flag.
          if (intent.destination !== 'matches') return
          if (competitionSlug === undefined || seasonSlug === undefined) return
          navigate(competitionSectionRoute({ competitionSlug, seasonSlug }, 'matches'))
          return
        default:
          return
      }
    },
    [navigate, competitionSlug, seasonSlug],
  )
}
