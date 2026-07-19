import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { PageShell, type NavKey } from '../design-system'

// Maps the current path to the active bottom-nav tab and back. The four tabs are
// the v0.1 set (design-system §6); each renders its route's screen in the shell.

const TAB_PATH: Record<NavKey, string> = {
  home: '/',
  predict: '/predict',
  league: '/league',
  more: '/more',
}

function activeTab(pathname: string): NavKey {
  if (pathname.startsWith('/predict')) return 'predict'
  if (pathname.startsWith('/league')) return 'league'
  if (pathname.startsWith('/more')) return 'more'
  return 'home'
}

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <PageShell active={activeTab(location.pathname)} onNavigate={(key) => navigate(TAB_PATH[key])}>
      <Outlet />
    </PageShell>
  )
}
