import type { ReactNode } from 'react'
import styles from './controlRoom.module.css'

export type OperationalState =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'not-configured'
  | 'unknown'
  | 'stale'
  | 'disabled'

const STATE_LABELS: Readonly<Record<OperationalState, string>> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
  'not-configured': 'Not configured',
  unknown: 'Unknown',
  stale: 'Stale',
  disabled: 'Disabled',
}

export function ControlRoomPage({
  eyebrow,
  title,
  intro,
  actions,
  children,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly intro: string
  readonly actions?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.pageTitle}>{title}</h1>
          <p className={styles.pageIntro}>{intro}</p>
        </div>
        {actions ? <div className={styles.pageActions}>{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}

export function StatusPill({ state, label }: { readonly state: OperationalState; readonly label?: string }) {
  return (
    <span className={styles.statusPill} data-state={state}>
      <span className={styles.statusDot} aria-hidden="true" />
      {label ?? STATE_LABELS[state]}
    </span>
  )
}

export function Panel({
  title,
  description,
  aside,
  children,
}: {
  readonly title: string
  readonly description?: string
  readonly aside?: ReactNode
  readonly children: ReactNode
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeading}>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  detail,
  state,
}: {
  readonly label: string
  readonly value: ReactNode
  readonly detail?: string
  readonly state?: OperationalState
}) {
  return (
    <article className={styles.stat} data-state={state}>
      <p className={styles.statLabel}>{label}</p>
      <strong className={styles.statValue}>{value}</strong>
      {detail ? <p className={styles.statDetail}>{detail}</p> : null}
    </article>
  )
}

export function ReadState({
  kind,
  title,
  detail,
}: {
  readonly kind: 'loading' | 'empty' | 'not-configured' | 'no-permission' | 'failed' | 'stale'
  readonly title: string
  readonly detail: string
}) {
  return (
    <div className={styles.readState} data-kind={kind} role={kind === 'failed' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}
