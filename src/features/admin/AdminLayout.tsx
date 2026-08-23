import { lazy, Suspense, type ReactNode } from 'react'
import { Activity, Bell, Bot, ChartNoAxesCombined, Database, FileClock, Gamepad2, Home, Radio, Server, ShieldCheck, Trophy, Users, UsersRound } from 'lucide-react'
import { Link, Navigate, useLocation, useOutlet } from 'react-router'
import { useSite } from '../../app/site/SiteProvider'
import { RouteFallback } from '../../app/RouteFallback'
import { snapshotAllowsCapability } from '../../services/supabase/adminAccess'
import type { AdminCapability } from '../../services/supabase/adminCapabilities'
import { useAdminAccess } from './AdminAccessContext'
import styles from './controlRoom.module.css'

const AdminOverviewPage = lazy(() => import('./AdminOverviewPage').then((module) => ({ default: module.AdminOverviewPage })))
const AdminFootballDataPage = lazy(() => import('./AdminFootballDataPage').then((module) => ({ default: module.AdminFootballDataPage })))
const AdminGamesPage = lazy(() => import('./AdminGamesPage').then((module) => ({ default: module.AdminGamesPage })))
const AdminLeaguesPage = lazy(() => import('./AdminLeaguesPage').then((module) => ({ default: module.AdminLeaguesPage })))
const AdminAuditPage = lazy(() => import('./AdminAuditPage').then((module) => ({ default: module.AdminAuditPage })))
const AdminNotificationsPage = lazy(() => import('./AdminNotificationsPage').then((module) => ({ default: module.AdminNotificationsPage })))
const AdminAnalyticsPage = lazy(() => import('./AdminAnalyticsPage').then((module) => ({ default: module.AdminAnalyticsPage })))
const AdminSystemPage = lazy(() => import('./AdminSystemPage').then((module) => ({ default: module.AdminSystemPage })))

type NavItem = {
  readonly to: string
  readonly label: string
  readonly icon: ReactNode
  readonly capability?: AdminCapability
  readonly superAdminOnly?: boolean
  readonly hubOnly?: boolean
  readonly euroOnly?: boolean
}

const NAV_GROUPS: readonly { readonly label: string; readonly items: readonly NavItem[] }[] = [
  {
    label: 'Control room',
    items: [
      { to: '/admin', label: 'Overview', icon: <Home size={17} aria-hidden="true" /> },
      { to: '/admin/season', label: 'Competitions', icon: <Trophy size={17} aria-hidden="true" />, capability: 'competitions' },
      { to: '/admin/season?workspace=football-data', label: 'Football Data', icon: <Radio size={17} aria-hidden="true" />, capability: 'competitions' },
      { to: '/admin/season?workspace=games', label: 'Games', icon: <Gamepad2 size={17} aria-hidden="true" />, capability: 'competitions' },
      { to: '/admin/results', label: 'Results Centre', icon: <Activity size={17} aria-hidden="true" />, capability: 'results' },
    ],
  },
  {
    label: 'People & intelligence',
    items: [
      { to: '/admin/users', label: 'Users', icon: <Users size={17} aria-hidden="true" />, capability: 'users' },
      { to: '/admin?workspace=leagues', label: 'Leagues & containers', icon: <UsersRound size={17} aria-hidden="true" />, capability: 'leagues', hubOnly: true },
      { to: '/admin/ai', label: 'AI Lab', icon: <Bot size={17} aria-hidden="true" />, capability: 'competitions', hubOnly: true },
      { to: '/admin?workspace=analytics', label: 'Analytics', icon: <ChartNoAxesCombined size={17} aria-hidden="true" /> },
      { to: '/admin?workspace=audit', label: 'Audit', icon: <FileClock size={17} aria-hidden="true" /> },
    ],
  },
  {
    label: 'Platform',
    items: [
      { to: '/admin?workspace=notifications', label: 'Notifications', icon: <Bell size={17} aria-hidden="true" />, capability: 'competitions' },
      { to: '/admin?workspace=system', label: 'System Health', icon: <Server size={17} aria-hidden="true" /> },
      { to: '/admin/euro', label: 'Euro publication', icon: <Database size={17} aria-hidden="true" />, superAdminOnly: true, euroOnly: true },
    ],
  },
]

function capabilityLabel(capability: AdminCapability): string {
  switch (capability) {
    case 'results': return 'Results'
    case 'competitions': return 'Competitions'
    case 'users': return 'Users'
    case 'leagues': return 'Leagues'
    case 'tournament': return 'Tournament'
  }
}

function pathAllowed(pathname: string, access: ReturnType<typeof useAdminAccess>): boolean {
  if (pathname === '/admin' || pathname === '/admin/') return true
  if (pathname.startsWith('/admin/results')) return snapshotAllowsCapability(access, 'results')
  if (pathname.startsWith('/admin/season') || pathname.startsWith('/admin/ai')) return snapshotAllowsCapability(access, 'competitions')
  if (pathname.startsWith('/admin/users')) return snapshotAllowsCapability(access, 'users')
  if (pathname.startsWith('/admin/euro')) return access.isSuperAdmin
  return false
}

function rootWorkspaceAllowed(workspace: string | null, access: ReturnType<typeof useAdminAccess>): boolean {
  if (workspace === null || workspace === 'audit' || workspace === 'analytics' || workspace === 'system') return true
  if (workspace === 'leagues') return snapshotAllowsCapability(access, 'leagues')
  if (workspace === 'notifications') return snapshotAllowsCapability(access, 'competitions')
  return false
}

function currentAddress(pathname: string, search: string): string {
  return `${pathname}${search}`
}

export function AdminLayout({ forceOverview = false }: { readonly forceOverview?: boolean } = {}) {
  const access = useAdminAccess()
  const site = useSite()
  const location = useLocation()
  const nested = useOutlet()
  const environment = import.meta.env.PROD ? 'production' : 'development'
  const workspace = new URLSearchParams(location.search).get('workspace')

  if (!pathAllowed(location.pathname, access)) return <Navigate to="/admin" replace />
  if ((location.pathname === '/admin' || location.pathname === '/admin/') && !rootWorkspaceAllowed(workspace, access)) return <Navigate to="/admin" replace />

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (item.hubOnly && !site.servesDomesticCompetitions) return false
      if (item.euroOnly && site.servesDomesticCompetitions) return false
      if (item.superAdminOnly) return access.isSuperAdmin
      if (item.capability) return snapshotAllowsCapability(access, item.capability)
      return true
    }),
  })).filter((group) => group.items.length > 0)

  const address = currentAddress(location.pathname, location.search)
  const nav = (
    <nav className={styles.nav} aria-label="Admin control room">
      {visibleGroups.map((group) => (
        <div className={styles.navGroup} key={group.label}>
          <p className={styles.navGroupTitle}>{group.label}</p>
          {group.items.map((item) => {
            const active = item.to === '/admin' ? address === '/admin' || address === '/admin/' : address === item.to
            return (
              <Link key={item.to} to={item.to} aria-current={active ? 'page' : undefined} className={active ? styles.navLinkActive : styles.navLink}>
                {item.icon}<span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )

  const overview = <Suspense fallback={<RouteFallback />}><AdminOverviewPage /></Suspense>
  const rootWorkspace = location.pathname === '/admin' || location.pathname === '/admin/'
    ? workspace === 'leagues' ? <Suspense fallback={<RouteFallback />}><AdminLeaguesPage /></Suspense>
      : workspace === 'audit' ? <Suspense fallback={<RouteFallback />}><AdminAuditPage /></Suspense>
        : workspace === 'notifications' ? <Suspense fallback={<RouteFallback />}><AdminNotificationsPage /></Suspense>
          : workspace === 'analytics' ? <Suspense fallback={<RouteFallback />}><AdminAnalyticsPage /></Suspense>
            : workspace === 'system' ? <Suspense fallback={<RouteFallback />}><AdminSystemPage /></Suspense>
              : null
    : null
  const operationsWorkspace = location.pathname === '/admin/season' && workspace === 'football-data'
    ? <Suspense fallback={<RouteFallback />}><AdminFootballDataPage /></Suspense>
    : location.pathname === '/admin/season' && workspace === 'games'
      ? <Suspense fallback={<RouteFallback />}><AdminGamesPage /></Suspense>
      : null

  const content = forceOverview ? overview : (rootWorkspace ?? operationsWorkspace ?? nested ?? overview)

  return (
    <div className={styles.root} data-admin-control-room="">
      <header className={styles.mobileHeader}>
        <span className={styles.brandMark}><ShieldCheck size={19} aria-hidden="true" />Control Room</span>
        <details className={styles.mobileMenu}>
          <summary className={styles.mobileSummary}>Sections</summary>
          <div className={styles.mobileNav}>{nav}</div>
        </details>
      </header>
      <div className={styles.frame}>
        <aside className={styles.rail} aria-label="Control Room navigation">
          <div className={styles.brand}>
            <span className={styles.brandMark}><ShieldCheck size={20} aria-hidden="true" />Predictor Hub</span>
            <p>Admin Control Room</p>
            <span className={styles.environment} data-environment={environment}>{environment.toUpperCase()}</span>
          </div>
          {nav}
          <div className={styles.railFooter}>
            <div className={styles.identity}>
              <strong>{access.email ?? 'Administrator'}</strong>
              <p>Access verified from Auth app metadata</p>
              <small>{access.isSuperAdmin ? 'Super administrator' : access.capabilities.map(capabilityLabel).join(' · ')}</small>
            </div>
            <Link className={styles.hubLink} to="/">Back to Predictor Hub</Link>
          </div>
        </aside>
        <div className={styles.canvas}>{content}</div>
      </div>
    </div>
  )
}
