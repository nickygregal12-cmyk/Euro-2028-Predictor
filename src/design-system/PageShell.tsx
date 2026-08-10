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
  /**
   * The persistent desktop rail. Rendered beside the content and hidden by CSS
   * below the desktop breakpoint, where the bottom bar is the navigation.
   * Omitted by harnesses that have no routes to offer.
   */
  rail?: ReactNode
  children: ReactNode
}

/**
 * The app frame: optional top bar, a desktop rail beside the scrolling content,
 * and the global BottomNav.
 *
 * THE GLOBAL NAVIGATION IS NOT OPTIONAL. It used to be, so that competition
 * routes could hide it and supply their own instead; the design authority
 * requires the global destinations to stay visible and unchanged inside
 * competition context, so the escape hatch is gone rather than left available
 * for the next surface to reach for.
 *
 * EXACTLY ONE OF THE TWO IS VISIBLE AT ANY WIDTH. Below 1024px the bottom bar
 * is the navigation and the rail is not rendered to the screen; at and above
 * it, the rail is and the bar is not. Both are always in the DOM, so no
 * JavaScript width measurement decides navigation — a measurement would flicker
 * on load and be wrong for the first paint. They carry the same five global
 * destinations in the same order, so this is a change of presentation and not
 * the destination swap the design authority forbids.
 */
export function PageShell({ topBar, active, onNavigate, rail, children }: PageShellProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      {topBar}
      <div className={styles.body}>
        {rail ? <div className={styles.rail}>{rail}</div> : null}
        <main id="main-content" className={styles.content} tabIndex={-1}>
          {/* The content is centred within the shell's maximum width rather
              than filling a 27-inch monitor edge to edge. Pages that want a
              second column compose `Workspace` inside this. */}
          <div className={styles.measure}>{children}</div>
        </main>
      </div>
      <BottomNav active={active} onNavigate={onNavigate} />
    </div>
  )
}
