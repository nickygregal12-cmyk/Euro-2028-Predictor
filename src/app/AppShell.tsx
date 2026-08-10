import { Suspense, useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AppBar, PageShell, SideRail, type NavKey } from '../design-system'
import { RouteFallback } from './RouteFallback'
import { useAuth } from '../features/auth/AuthProvider'
import { useTheme } from './providers/ThemeProvider'
import { railGroups } from './railDestinations'
import {
  PlayerCompetitionsProvider,
  usePlayerCompetitions,
} from './providers/PlayerCompetitionsProvider'
import { useRailCollapsed } from './useRailCollapsed'
import { globalNavTab, isCompetitionModePath } from './shellRoutes'

const TAB_CONTEXT: Record<NavKey, string> = {
  home: 'Home',
  predict: 'Play',
  matches: 'Matches',
  league: 'Leagues',
  more: 'More',
}

/**
 * The signed-in frame.
 *
 * THE GLOBAL NAVIGATION IS ALWAYS THERE, including inside a competition. It
 * used to be hidden for the whole `/competitions/**` family, on the reasoning
 * that competition mode "owns its navigation" — but the design authority is
 * explicit in the other direction: the global rail "remains visible inside
 * competition context", "never swaps its destinations", and the Hub is
 * therefore "one click away without a compensating Back to Hub control", which
 * that authority lists among the things not to do. Hiding it meant a player who
 * tapped through to a game lost every global destination at once and could
 * leave only by a Back link or the browser's own back button.
 *
 * The competition masthead and its sub-navigation sit inside the content
 * column, under the bar rather than instead of it, so competition identity is
 * still unmistakable.
 *
 * ON DESKTOP THE SAME NAVIGATION IS A PERSISTENT LEFT RAIL. `PageShell` shows
 * exactly one of the two at any width; the rail's first group is the bar's own
 * destinations in the bar's order, and the two groups beneath it are the extra
 * reach the width pays for.
 *
 * THE RAIL IS PERMANENTLY GLOBAL. It carries bounded shortcuts to the player's
 * own competitions, each opening that competition's Overview, and never expands
 * into a competition's sections — those live under the competition masthead in
 * the content column, where both layers are visible at once because they answer
 * different questions.
 */
export function AppShell() {
  return (
    <PlayerCompetitionsProvider>
      <SignedInFrame />
    </PlayerCompetitionsProvider>
  )
}

function SignedInFrame() {
  const location = useLocation()
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const { theme, toggle } = useTheme()
  const rail = useRailCollapsed()
  // One membership read for the whole shell. The rail's shortcuts are the
  // server's answer about this player, never the catalogue's placeholder flags.
  const { player } = usePlayerCompetitions()
  const competitionMode = isCompetitionModePath(location.pathname)
  const tab = globalNavTab(location.pathname)
  const groups = useMemo(() => railGroups(player), [player])

  return (
    <PageShell
      active={tab}
      rail={
        <SideRail
          groups={groups}
          pathname={location.pathname}
          collapsed={rail.collapsed}
          onToggleCollapsed={rail.toggle}
        />
      }
      topBar={
        <AppBar
          context={competitionMode ? 'Competition' : TAB_CONTEXT[tab]}
          theme={theme}
          onToggleTheme={toggle}
          displayName={displayName}
          onOpenProfile={() => navigate('/profile')}
        />
      }
    >
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </PageShell>
  )
}
