import styles from './RouteFallback.module.css'

// Lightweight loading state shown while a lazily-loaded route chunk resolves
// (App is code-split per route). Neutral, token-driven, and quiet — a slim
// progress bar rather than a spinner jump, honouring prefers-reduced-motion.
export function RouteFallback() {
  return (
    <div className={styles.root} role="status" aria-live="polite" aria-label="Loading">
      <div className={styles.bar}>
        <div className={styles.fill} />
      </div>
    </div>
  )
}
