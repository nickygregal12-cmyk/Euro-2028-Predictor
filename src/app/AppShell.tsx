import { Suspense } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AppBar, PageShell, type NavKey } from '../design-system'
import { RouteFallback } from './RouteFallback'
import { useAuth } from '../features/auth/AuthProvider'
import { useTheme } from './providers/ThemeProvider'
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
 */
export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const { theme, toggle } = useTheme()
  const competitionMode = isCompetitionModePath(location.pathname)
  const tab = globalNavTab(location.pathname)

  return (
    <PageShell
      active={tab}
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
