import styles from './Skeleton.module.css'

type Radius = 'input' | 'card' | 'pill' | 'circle'

export type SkeletonProps = {
  width?: string | number
  height?: string | number
  radius?: Radius
  // When set, renders this many stacked text-line bars (the last one shorter),
  // for paragraph placeholders.
  lines?: number
}

const RADIUS: Record<Radius, string> = {
  input: 'var(--radius-input)',
  card: 'var(--radius-card)',
  pill: 'var(--radius-pill)',
  circle: '50%',
}

function size(v: string | number | undefined) {
  if (v === undefined) return undefined
  return typeof v === 'number' ? `${v}px` : v
}

/**
 * Loading placeholder for content areas (design-system §6 — skeletons, not
 * spinners). Shimmer respects prefers-reduced-motion (falls back to a static
 * fill). Decorative: aria-hidden — the parent region owns aria-busy.
 * Presentational only.
 */
export function Skeleton({ width, height = 16, radius = 'input', lines }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className={styles.lines} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={styles.bar}
            style={{
              width: i === lines - 1 ? '60%' : size(width) ?? '100%',
              height: size(height),
              borderRadius: RADIUS[radius],
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <span
      className={styles.bar}
      aria-hidden="true"
      style={{
        display: 'block',
        width: size(width) ?? '100%',
        height: size(height),
        borderRadius: RADIUS[radius],
      }}
    />
  )
}
