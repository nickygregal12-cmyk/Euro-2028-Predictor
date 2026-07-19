import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

export type EmptyStateProps = {
  // Optional decorative glyph (an icon from the set). Rendered muted; the
  // heading carries the meaning, not colour (design-system §7).
  icon?: ReactNode
  title: string
  description?: ReactNode
  // Optional call-to-action, e.g. a <Button>.
  action?: ReactNode
}

/**
 * The empty / "nothing here yet" state for a content area (design-system §6 —
 * every screen ships an empty state). Also used for not-yet-built sections
 * ("coming soon"). Presentational only.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
