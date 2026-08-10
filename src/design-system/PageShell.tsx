import type { ReactNode } from 'react'
import styles from './PageShell.module.css'
import { BottomNav, type NavKey } from './BottomNav'

export type PageShellProps = {
  // Slim bar rendered above the content region (the AppBar). Page titles stay
  // content-owned — the legacy title/headerAction header is retired
  // (design-system §6, one title system).
  topBar?: ReactNode
  active: NavKey
  /** Dev/demo-only override. Production navigation should omit this. */
  onNavigate?: (key: NavKey) => void
  children: ReactNode
}

/**
 * The app frame: optional top bar, scrolling content, and the global BottomNav.
 *
 * THE BOTTOM NAVIGATION IS NOT OPTIONAL. It used to be, so that competition
 * routes could hide it and supply their own navigation instead; the design
 * authority requires the global destinations to stay visible and unchanged
 * inside competition context, so the escape hatch is gone rather than left
 * available for the next surface to reach for.
 */
export function PageShell({ topBar, active, onNavigate, children }: PageShellProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      {topBar}
      <main id="main-content" className={styles.content} tabIndex={-1}>
        {children}
      </main>
      <BottomNav active={active} onNavigate={onNavigate} />
    </div>
  )
}
