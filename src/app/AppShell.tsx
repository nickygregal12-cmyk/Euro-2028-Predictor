import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { PageShell, type NavKey } from '../design-system'
import { RouteFallback } from './RouteFallback'

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

export function AppShell() {
  const location = useLocation()
  return (
    <PageShell active={activeTab(location.pathname)}>
      {/* Lazily-loaded route chunks resolve here; the nav stays put while the
          content area shows the fallback. */}
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </PageShell>
  )
}
