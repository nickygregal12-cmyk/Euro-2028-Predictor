import type { ReactNode } from 'react'
import styles from './PageShell.module.css'
import { BottomNav, type NavKey } from './BottomNav'

export type PageShellProps = {
  // Header title for the current section. Omit for screens that render their
  // own header inside `children`.
  title?: string
  // Optional right-aligned header slot (e.g. a settings button).
  headerAction?: ReactNode
  active: NavKey
  /** Dev/demo-only override. Production navigation should omit this. */
  onNavigate?: (key: NavKey) => void
  children: ReactNode
}

/**
 * The app frame: sticky header, scrolling content, and the fixed BottomNav.
 * Fills its container height (use 100dvh at the app root); the content region
 * scrolls independently so the nav stays put. Presentational only.
 */
export function PageShell({ title, headerAction, active, onNavigate, children }: PageShellProps) {
  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      {title || headerAction ? (
        <header className={styles.header}>
          {title ? <h1 className={styles.title}>{title}</h1> : <span />}
          {headerAction ? <div className={styles.headerAction}>{headerAction}</div> : null}
        </header>
      ) : null}
      <main id="main-content" className={styles.content} tabIndex={-1}>
        {children}
      </main>
      <BottomNav active={active} onNavigate={onNavigate} />
    </div>
  )
}
