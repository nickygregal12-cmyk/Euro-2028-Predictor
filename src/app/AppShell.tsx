import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { AppBar, PageShell, SideRail, type NavKey } from '../design-system'
import { RouteFallback } from './RouteFallback'
import { useAuth } from '../features/auth/AuthProvider'
import { useTheme } from './providers/ThemeProvider'
import { railGroups } from './railDestinations'
import { useSite } from './site/SiteProvider'
import { globalNavItems } from './site/navigation'
import {
  PlayerCompetitionsProvider,
  usePlayerCompetitions,
} from './providers/PlayerCompetitionsProvider'
import { useRailCollapsed } from './useRailCollapsed'
import { outstandingCount } from './outstandingCount'
import { applyAppBadge } from './appBadge'
import { useGlobalPlayInbox } from '../features/hub/useGlobalPlayInbox'
import { usePersistentActions } from './usePersistentActions'

const ActionCentre = lazy(() =>
  import('./ActionCentre').then((module) => ({ default: module.ActionCentre })),
)
import { globalNavTab, isCompetitionModePath, isTvModePath } from './shellRoutes'

function navLabel(
  items: readonly { key: NavKey; label: string }[],
  tab: NavKey,
): string | undefined {
  return items.find((item) => item.key === tab)?.label
}

const TAB_CONTEXT: Record<NavKey, string> = {
  home: 'Home',
  predict: 'Play',
  matches: 'Matches',
  league: 'Leagues',
  more: 'More',
}

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
  const { player } = usePlayerCompetitions()
  const competitionMode = isCompetitionModePath(location.pathname)
  const tab = globalNavTab(location.pathname)
  const site = useSite()
  const navItems = useMemo(() => globalNavItems(site), [site])
  const groups = useMemo(() => railGroups(player, site), [player, site])
  const { status: inboxStatus, inbox } = useGlobalPlayInbox(player)
  const [actionsOpen, setActionsOpen] = useState(false)

  // Persistent actions are intentionally separate from the outstanding-work
  // badge. Opening the panel reads the server-owned cross-device feed, marks
  // unseen rows seen through its bounded command and lets the player dismiss a
  // server-issued action. It never changes whether a game action is still due.
  const persistent = usePersistentActions(actionsOpen)

  const outstanding = outstandingCount(inbox)
  useEffect(() => {
    if (inboxStatus !== 'ready') return
    applyAppBadge(outstanding)
  }, [inboxStatus, outstanding])

  if (isTvModePath(location.pathname)) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    )
  }

  return (
    <PageShell
      active={tab}
      navItems={navItems}
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
          context={
            competitionMode ? 'Competition' : (navLabel(navItems, tab) ?? TAB_CONTEXT[tab])
          }
          theme={theme}
          onToggleTheme={toggle}
          displayName={displayName}
          onOpenProfile={() => navigate('/profile')}
          actions={{
            outstanding,
            onOpen: () => setActionsOpen(true),
          }}
        />
      }
    >
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
      {actionsOpen ? (
        <Suspense fallback={null}>
          <ActionCentre
            open
            onClose={() => setActionsOpen(false)}
            status={inboxStatus === 'ready' ? 'ready' : 'loading'}
            inbox={inbox}
            persistentStatus={persistent.status}
            persistentActions={persistent.actions}
            onDismissPersistentAction={persistent.dismiss}
          />
        </Suspense>
      ) : null}
    </PageShell>
  )
}
