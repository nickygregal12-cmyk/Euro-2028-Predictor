import type { ReactNode } from 'react'
import styles from './Masthead.module.css'

export type MastheadProps = {
  /**
   * The page's own header content — eyebrow, title, season, status.
   *
   * There is deliberately no `title` prop. design-system §6 ("one title
   * system") makes page headers content-owned and retired `PageShell`'s
   * `title`/`headerAction` props in 2026-07-28 so that no surface could carry
   * two header systems at once. A masthead that rendered its own title would
   * reintroduce exactly that, so this component decorates the header the page
   * already owns and never replaces it.
   */
  children: ReactNode
  /**
   * Lets a competition surface set `--masthead-accent` from its own CSS module
   * (design-system §11.8). Competition identity is supplied as a token by the
   * caller; no competition branding is encoded here.
   */
  className?: string
}

/**
 * The contained decoration band behind a hub or competition page header
 * (design-system §11.2).
 *
 * The Broadcast Grid decoration is CSS and inline SVG computed from tokens —
 * no raster asset, no remote asset, and nothing generated at runtime (§11.1).
 * It is drawn at `--line` luminance and kept out of the text column, so text in
 * the band sits on `--bg` and inherits the AA pairings §2 already pins; there
 * is no scrim and no text shadow (§11.4).
 *
 * The band bleeds to the viewport edge against `PageShell`'s 16px content
 * padding and re-applies the same padding inside, which is width-neutral and
 * cannot introduce horizontal overflow.
 */
export function Masthead({ children, className }: MastheadProps) {
  return (
    <div className={className ? `${styles.masthead} ${className}` : styles.masthead}>
      <div className={styles.decoration} aria-hidden="true">
        <div className={styles.rules} />
        <div className={styles.dots} />
        <svg
          className={styles.mark}
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          {/* Framing mark: a broadcast viewfinder, not a logo. Every stroke is
              inset from the viewBox edge so nothing clips against the band's
              overflow at any width. */}
          <path d="M4 16V4h12" stroke="currentColor" strokeWidth="1" />
          <path d="M44 16V4H32" stroke="currentColor" strokeWidth="1" />
          <path d="M4 32v12h12" stroke="currentColor" strokeWidth="1" />
          <path d="M44 32v12H32" stroke="currentColor" strokeWidth="1" />
          <circle cx="24" cy="24" r="4" stroke="currentColor" strokeWidth="1" />
          <path d="M24 14v-3M24 37v-3M14 24h-3M37 24h-3" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  )
}
