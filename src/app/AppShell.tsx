import { Suspense, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PageShell, type NavKey } from '../design-system'
import { RouteFallback } from './RouteFallback'
import { useScrollRestoration } from './navRestore'

// Maps the current path to the active bottom-nav tab and back. The four tabs are
// the v0.1 set (design-system §6); each renders its route's screen in the shell.

const TAB_PATH: Record<NavKey, string> = {
  home: '/',
  predict: '/predict',
  matches: '/matches',
  league: '/league',
  more: '/more',
}

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
  const navigate = useNavigate()
  // Restore scroll position on back/forward for the scrolling content region.
  const contentRef = useRef<HTMLElement>(null)
  useScrollRestoration(contentRef)
  return (
    <PageShell
      active={activeTab(location.pathname)}
      onNavigate={(key) => navigate(TAB_PATH[key])}
      contentRef={contentRef}
    >
      {/* Lazily-loaded route chunks resolve here; the nav stays put while the
          content area shows the fallback. */}
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </PageShell>
  )
}
