import { Suspense } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AppBar, PageShell, type NavKey } from '../design-system'
import { RouteFallback } from './RouteFallback'
import { useAuth } from '../features/auth/AuthProvider'
import { useTheme } from './providers/ThemeProvider'

// Maps the current path to the active bottom-nav tab. The five tab destinations
// are declared with their semantic links in BottomNav.
function activeTab(pathname: string): NavKey {
  if (pathname.startsWith('/predict')) return 'predict'
  // The per-fixture match centre (/match/:ref) belongs to the Matches tab.
  if (pathname.startsWith('/matches') || pathname.startsWith('/match/')) return 'matches'
  if (pathname.startsWith('/league')) return 'league'
  if (pathname.startsWith('/more')) return 'more'
  return 'home'
}

// The app bar's left slot carries section context only; page titles stay
// content-owned (design-system §6). Labels mirror the BottomNav tabs.
const TAB_CONTEXT: Record<NavKey, string> = {
  home: 'Home',
  predict: 'Predict',
  matches: 'Matches',
  league: 'League',
  more: 'More',
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { displayName } = useAuth()
  const { theme, toggle } = useTheme()
  const tab = activeTab(location.pathname)

  return (
    <PageShell
      active={tab}
      topBar={
        <AppBar
          context={TAB_CONTEXT[tab]}
          theme={theme}
          onToggleTheme={toggle}
          displayName={displayName}
          onOpenProfile={() => navigate('/profile')}
        />
      }
    >
      {/* Lazily-loaded route chunks resolve here; the nav stays put while the
          content area shows the fallback. */}
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </PageShell>
  )
}
