import type { ReactNode } from 'react'
import surfaces from '../surfaces.module.css'
import typography from '../typography.module.css'
import styles from './Rail.module.css'

export type RailProps = {
  /** Names the rail for assistive technology and heads it visually. */
  title: string
  /** Optional short line under the title — a count, a deadline, a state. */
  meta?: ReactNode
  children: ReactNode
}

/**
 * A horizontally browsable row of cards — the Netflix-shaped half of the
 * inspiration, used for fixtures rather than for decoration.
 *
 * Three things make it usable rather than just scrollable:
 *
 * - it is a labelled `<section>`, so a screen reader can find and name it;
 * - the scroller carries `tabindex={0}`, because a scrollable region no
 *   keyboard user can reach fails WCAG 2.1.1 — the same reason the repository
 *   turns `jsx-a11y/no-noninteractive-tabindex` off;
 * - the list is a real `<ul>`, so the number of items is announced.
 *
 * Scroll snapping is `proximity`, not `mandatory`: mandatory snapping fights
 * a user who is trying to read something halfway between two cards.
 */
export function Rail({ title, meta, children }: RailProps) {
  return (
    <section className={styles.rail} aria-label={title}>
      <header className={styles.header}>
        <h2 className={typography.label}>{title}</h2>
        {meta ? <p className={typography.caption}>{meta}</p> : null}
      </header>
      <div className={`${surfaces.rail} ${styles.scroller}`} tabIndex={0}>
        <ul className={styles.list}>{children}</ul>
      </div>
    </section>
  )
}

export type RailItemProps = {
  children: ReactNode
}

export function RailItem({ children }: RailItemProps) {
  return <li className={`${surfaces.railItem} ${styles.item}`}>{children}</li>
}
