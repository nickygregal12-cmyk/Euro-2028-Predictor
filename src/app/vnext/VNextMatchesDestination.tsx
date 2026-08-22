import { useNavigate, useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { VNextMatchesScreen } from '../../vnext/integration/matches/VNextMatchesScreen'
import { VNextMatchCentreScreen } from '../../vnext/integration/matches/VNextMatchCentreScreen'
import { isNextUi } from '../routeFlags'
import { competitionMatchCentreRoute } from '../weeklyRoutes'
import { matchCentreIntentRoute } from './matchCentreNavigation'
import { useShellIntentNavigation, useViewerFormatting } from './seam'
import { VNextAppRoot } from './VNextAppRoot'

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
    <VNextAppRoot>
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
    </VNextAppRoot>
  )
}

/**
 * The Match Centre, addressed by its fixture.
 *
 * `competitionSlug` and `seasonSlug` are passed through even though contract
 * 148 does not need them, because the SCREEN uses them for the way back —
 * "Back to Matches" has to name a competition even when the fixture read
 * could resolve without one.
 *
 * THE MATCH PREDICTOR LINK IS A HOST CAPABILITY, NOT A GUESS. The Stage 8
 * source only produces it when the host says the season Match Predictor route
 * is reachable AND the competition context resolves. This adapter supplies
 * that route fact and turns the emitted intent into the application's existing
 * game address. It deliberately does not opt the page into any additional
 * social reads: opening the core football context remains network-neutral.
 */
export function VNextMatchCentreDestination() {
  useViewerFormatting()
  const { competitionSlug, seasonSlug, fixtureId } = useParams()
  const { userId, loading } = useAuth()
  const navigate = useNavigate()
  const onShellIntent = useShellIntentNavigation()
  const predictorReachable = isNextUi('seasonMatchPredictor')

  return (
    <VNextAppRoot>
      <VNextMatchCentreScreen
        userId={userId}
        authLoading={loading}
        fixtureId={fixtureId ?? ''}
        competitionSlug={competitionSlug}
        seasonSlug={seasonSlug}
        predictorReachable={predictorReachable}
        onShellIntent={onShellIntent}
        onIntent={(intent) => {
          if (competitionSlug === undefined || seasonSlug === undefined) return
          const href = matchCentreIntentRoute({ competitionSlug, seasonSlug }, intent)
          if (href !== null) navigate(href)
        }}
      />
    </VNextAppRoot>
  )
}

/*
 * `useViewerFormatting` AND `useShellIntentNavigation` MOVED TO `seam.tsx`.
 *
 * They were written here when Matches was the only cutover adapter and there
 * was nothing to share them with. There are nine now, and nine copies of "which
 * zone does a reader see" and "where does this navigation go" is nine places
 * for one answer to drift — in the shell's own navigation, which is the last
 * part of a product that can afford to be untrustworthy.
 *
 * `useShellIntentNavigation` also GREW while it moved. This version ignored a
 * destination intent for Home, Games and Leagues, because answering it would
 * have dropped a player into a legacy page mid-journey. The cutover is what
 * removes that constraint: all four destinations are vNext now, so all four
 * are answered.
 */
