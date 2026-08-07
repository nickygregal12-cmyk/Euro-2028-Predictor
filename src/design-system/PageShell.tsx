import type { ReactNode } from 'react'
import styles from './PageShell.module.css'
import { BottomNav, type NavKey } from './BottomNav'

export type PageShellProps = {
  // Slim bar rendered above the content region (the AppBar). Page titles stay
  // content-owned — the legacy title/headerAction header is retired
  // (design-system §6, one title system).
  topBar?: ReactNode
  active: NavKey
  /** Competition mode owns its navigation and therefore hides the global tabs. */
  showBottomNav?: boolean
  /** Dev/demo-only override. Production navigation should omit this. */
  onNavigate?: (key: NavKey) => void
  children: ReactNode
}

/**
 * The app frame: optional top bar, scrolling content, and the global BottomNav
 * when the current route is in Hub mode. Competition mode keeps the top bar for
 * account/theme access but supplies its own competition navigation.
 */
export function PageShell({
  topBar,
  active,
  showBottomNav = true,
  onNavigate,
  children,
}: PageShellProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      {topBar}
      <main id="main-content" className={styles.content} tabIndex={-1}>
        {children}
      </main>
      {showBottomNav ? <BottomNav active={active} onNavigate={onNavigate} /> : null}
    </div>
  )
}
