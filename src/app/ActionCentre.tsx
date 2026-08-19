import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Alert } from '../design-system'
import { weeklyRoutes } from './weeklyRoutes'
import type { InboxAction, PlayInbox } from '../features/hub/playInboxModel'
import type { PersistentPlayerAction } from '../services/supabase/playerActions'
import {
  usePersistentActions,
  type PersistentActionsGateway,
  type PersistentActionsStatus,
} from './usePersistentActions'
import styles from './ActionCentre.module.css'

/**
 * Everything the player owes, plus the canonical persistent activity feed.
 *
 * This component is already lazy-loaded from AppShell. The persistent Supabase
 * service and hook live behind the same boundary so opening the occasional
 * Action Centre does not make every route pay their entry-chunk cost.
 */
export type ActionCentreProps = {
  open: boolean
  onClose: () => void
  status: 'loading' | 'ready'
  inbox: PlayInbox | null
  /** Test seam only; production uses the canonical Supabase gateway. */
  persistentSource?: PersistentActionsGateway
}

export function ActionCentre({
  open,
  onClose,
  status,
  inbox,
  persistentSource,
}: ActionCentreProps) {
  const closer = useRef<HTMLButtonElement>(null)
  const persistent = usePersistentActions(open, persistentSource)

  useEffect(() => {
    if (!open) return
    closer.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.root}>
      <button
        type="button"
        className={styles.scrim}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-centre-title"
      >
        <header className={styles.head}>
          <h2 className={styles.title} id="action-centre-title">To do</h2>
          <button type="button" className={styles.close} onClick={onClose} ref={closer}>
            Close
          </button>
        </header>

        {status === 'loading' || !inbox ? (
          <p className={styles.note} aria-live="polite">Checking your competitions…</p>
        ) : (
          <>
            {inbox.unreadable.length > 0 ? (
              <Alert variant="warning" title="Some competitions could not be checked">
                {inbox.unreadable.join(', ')}. Anything due there is missing from this list.
              </Alert>
            ) : null}
            <Group title="Due soon" actions={inbox.urgent} onNavigate={onClose} urgent />
            <Group title="This week" actions={inbox.thisWeek} onNavigate={onClose} />
            <Group title="Done and waiting" actions={inbox.settled} onNavigate={onClose} />
            {inbox.allClear ? (
              <p className={styles.clear}>You are up to date in every competition you play.</p>
            ) : null}
            {inbox.empty ? (
              <p className={styles.note}>
                Nothing to do yet — join a game in a competition and it will appear here.
              </p>
            ) : null}
          </>
        )}

        <PersistentUpdates
          status={persistent.status}
          actions={persistent.actions}
          onDismiss={persistent.dismiss}
        />

        <Link className={styles.all} to={weeklyRoutes.play} onClick={onClose}>Open Play</Link>
      </div>
    </div>
  )
}

function Group({
  title,
  actions,
  onNavigate,
  urgent = false,
}: {
  title: string
  actions: readonly InboxAction[]
  onNavigate: () => void
  urgent?: boolean
}) {
  if (actions.length === 0) return null
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      <ul className={styles.list}>
        {actions.map((action) => {
          const body = (
            <>
              <span className={styles.actionTitle}>{action.title}</span>
              <span className={styles.actionWhere}>
                {action.gameName} · {action.competitionName} {action.seasonLabel}
              </span>
            </>
          )
          return (
            <li key={action.key} className={urgent ? styles.itemUrgent : styles.item}>
              {action.href ? (
                <Link className={styles.action} to={action.href} onClick={onNavigate}>{body}</Link>
              ) : (
                <span className={styles.action}>{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const ACTION_TITLES: Readonly<Record<string, string>> = {
  matchweek_predictions_due: 'Predictions due',
  lms_pick_due: 'Last Man Standing pick due',
  cup_penalty_number_due: 'Cup penalty number due',
  matchweek_settled: 'Matchweek settled',
  game_consequence: 'Game update',
  // Rendered only if the SERVER supplies a real invitation action. The current
  // reusable share-code model creates no such row and the client manufactures none.
  league_invitation: 'League invitation',
}

function PersistentUpdates({
  status,
  actions,
  onDismiss,
}: {
  status: PersistentActionsStatus
  actions: readonly PersistentPlayerAction[]
  onDismiss: (actionKey: string) => Promise<void>
}) {
  return (
    <section className={styles.updates} aria-labelledby="action-updates-title">
      <h3 className={styles.groupTitle} id="action-updates-title">Updates</h3>
      {status === 'idle' || status === 'loading' ? (
        <p className={styles.note} aria-live="polite">Checking saved updates…</p>
      ) : null}
      {status === 'error' ? (
        <Alert variant="warning" title="Saved updates could not be checked">
          Your current to-do list is still available above. Try opening this panel again later.
        </Alert>
      ) : null}
      {status === 'ready' && actions.length === 0 ? (
        <p className={styles.note}>No saved updates to review.</p>
      ) : null}
      {status === 'ready' && actions.length > 0 ? (
        <ul className={styles.persistentList}>
          {actions.map((action) => (
            <li className={styles.persistentItem} key={action.actionKey}>
              <span className={styles.persistentCopy}>
                <span className={styles.actionTitle}>
                  {ACTION_TITLES[action.actionType] ?? 'Competition update'}
                </span>
                <span className={styles.persistentMeta}>{action.seen ? 'Seen' : 'New'}</span>
              </span>
              <button
                type="button"
                className={styles.dismiss}
                onClick={() => void onDismiss(action.actionKey)}
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
