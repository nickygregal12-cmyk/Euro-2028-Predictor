import styles from './TeamFlag.module.css'

export type TeamFlagSize = 'card' | 'table' | 'venue'

export type TeamFlagProps = {
  // ISO 3166-1 alpha-2 or a flag-icons subdivision code, e.g. 'fr', 'gb-eng'.
  countryCode: string
  // Accessible name (design-system §7 — all flags get labels).
  label: string
  size?: TeamFlagSize
}

/**
 * A national flag from the flag-icons library, wrapped with the design-system
 * hairline outline (so white-heavy flags don't dissolve into light surfaces)
 * and rendered at a fixed 3:2 box. Card 30×20, table 26×17, venue 18×12.
 */
export function TeamFlag({ countryCode, label, size = 'card' }: TeamFlagProps) {
  return (
    <span
      className={`fi fi-${countryCode.toLowerCase()} ${styles.flag} ${styles[size]}`}
      role="img"
      aria-label={label}
    />
  )
}
