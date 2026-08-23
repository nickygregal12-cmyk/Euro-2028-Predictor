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
// THE PANEL IS LAZY, THE COUNT IS NOT, and the split is the point. The badge
// has to be right on first paint or it is worse than absent, so the inbox and
// `outstandingCount` stay in the entry chunk; the panel's markup and styles are
// only needed once somebody opens it, and statically importing them put the
// entry chunk over its compressed budget.
import { outstandingCount } from './outstandingCount'
import { applyAppBadge } from './appBadge'
import { useGlobalPlayInbox } from '../features/hub/useGlobalPlayInbox'

const ActionCentre = lazy(() =>
  import('./ActionCentre').then((module) => ({ default: module.ActionCentre })),
)
// Privileged discovery is needed only once a vNext-owned signed-in frame is on
// screen. Keeping it behind its own chunk prevents the Auth metadata lookup,
// icon and Control Room utility CSS from becoming entry-chunk tax for every
// legacy/non-vNext visit. The `/admin` route remains the authorization gate.
const AdminUtilityEntry = lazy(() =>
  import('./vnext/AdminUtilityEntry').then((module) => ({ default: module.AdminUtilityEntry })),
)
import { globalNavTab, isCompetitionModePath, isTvModePath } from './shellRoutes'
import { vNextOwnsFrame } from './vnext/frameOwnership'

function navLabel(
  items: readonly { key: NavKey; label: string }[],
  tab: NavKey,
): string | undefined {
  return items.find((item) => item.key === tab)?.label
}

/** Fallback wording, used only for a tab this deployment does not offer. */
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
  // WHICH PRODUCT THIS BUILD IS. The two deployments share every route and
  // differ in what the destinations are called and in what order they lead —
  // so the bar and the rail both read from one configuration rather than each
  // carrying a list that could disagree with the other.
  const site = useSite()
  const navItems = useMemo(() => globalNavItems(site), [site])
  const groups = useMemo(() => railGroups(player, site), [player, site])
  // ONE inbox read for the shell, shared with the action centre. `/play` mounts
  // its own; both go through the same hook and the same model, so the two
  // cannot disagree about what is due.
  const { status: inboxStatus, inbox } = useGlobalPlayInbox(player)
  const [actionsOpen, setActionsOpen] = useState(false)

  // INNOV-023. The installed app's icon carries the SAME number the AppBar
  // shows, from the same inbox — never a second count — and does nothing at all
  // where the platform has no Badging API. It is deliberately not applied while
  // the inbox is still loading: badging zero and then three reads as work
  // appearing out of nowhere.
  const outstanding = outstandingCount(inbox)
  useEffect(() => {
    if (inboxStatus !== 'ready') return
    applyAppBadge(outstanding)
  }, [inboxStatus, outstanding])

  // INNOV-006. Matchday television deliberately carries no account/admin
  // utility. It is a read-across-the-room surface, not signed-in application
  // chrome, so it must leave this frame before privileged discovery mounts.
  if (isTvModePath(location.pathname)) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    )
  }

  // STAGE 14. A cut-over destination owns its own vNext frame. The Admin entry
  // sits beside that frame rather than inside presentation modules: visibility
  // resolves trusted Auth app_metadata in the application layer and `/admin`
  // independently re-authorises. The site-aware ownership argument is retained
  // so shared Euro addresses never inherit domestic-only vNext chrome.
  if (
    vNextOwnsFrame(location.pathname, {
      servesDomesticCompetitions: site.servesDomesticCompetitions,
    })
  ) {
    return (
      <>
        <Suspense fallback={null}>
          <AdminUtilityEntry />
        </Suspense>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </>
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
      {/* Mounted only once opened, so the closed shell pays nothing for it and
          the fallback is never seen on a page that never opens it. */}
      {actionsOpen ? (
        <Suspense fallback={null}>
          <ActionCentre
            open
            onClose={() => setActionsOpen(false)}
            status={inboxStatus === 'ready' ? 'ready' : 'loading'}
            inbox={inbox}
          />
        </Suspense>
      ) : null}
    </PageShell>
  )
}
