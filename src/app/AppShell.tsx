import { Suspense } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AppBar, PageShell, type NavKey } from '../design-system'
import { RouteFallback } from './RouteFallback'
import { useAuth } from '../features/auth/AuthProvider'
import { useTheme } from './providers/ThemeProvider'
import { isCompetitionModePath, weeklyRoutes } from './weeklyRoutes'

function activeTab(pathname: string): NavKey {
  if (pathname === weeklyRoutes.play) return 'predict'
  if (pathname === weeklyRoutes.matches || pathname.startsWith('/match/')) return 'matches'
  if (pathname === weeklyRoutes.leagues || pathname.startsWith('/league/')) return 'league'
  if (
    pathname === weeklyRoutes.more ||
    pathname.startsWith('/more/') ||
    pathname === '/account' ||
    pathname.startsWith('/profile')
  ) {
    return 'more'
  }
  return 'home'
}

const TAB_CONTEXT: Record<NavKey, string> = {
  home: 'Home',
  predict: 'Play',
  matches: 'Matches',
  league: 'Leagues',
  more: 'More',
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const { theme, toggle } = useTheme()
  const competitionMode = isCompetitionModePath(location.pathname)
  const tab = activeTab(location.pathname)

  return (
    <PageShell
      active={tab}
      showBottomNav={!competitionMode}
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
