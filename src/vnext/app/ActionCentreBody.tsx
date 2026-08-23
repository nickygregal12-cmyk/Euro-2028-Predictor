import { useId, useState } from 'react'
import {
  actionIsOpenable,
  actionsNeedingYou,
  actionsNews,
  type VNextActionItem,
  type VNextActionsModel,
} from '../models/actions'
import text from '../foundations/typography.module.css'
import styles from './ActionCentreBody.module.css'

/**
 * THE ACTION CENTRE — the durable inbox the Football Hub cutover left behind.
 *
 * ============================ WHAT IT IS FOR =============================
 *
 * `AttentionElsewhere` answers "what needs doing in a competition you are not
 * currently looking at", derived live and deliberately quiet. This answers a
 * different question: what has the SERVER recorded for this player, across
 * everything, and have they seen it. It includes news as well as work, and it
 * is the only one of the two whose read state survives a change of device.
 *
 * ============================ WORK FIRST, THEN NEWS ======================
 *
 * Two groups, because they are read differently. A player scanning for what
 * they owe must not have to read past three settled matchweeks to find a pick
 * that locks within the hour. The SPLIT is the server's `action_type` and the
 * ORDER INSIDE each group is the server's `priority` — nothing here sorts,
 * because an LMS pick outranking a matchweek is a game rule about elimination
 * and it lives in the database.
 *
 * ============================ IT CLAIMS NOTHING IT WAS NOT TOLD ==========
 *
 * A row with no detail draws no detail. A competition the player's list does
 * not cover is named as unknown rather than labelled with its id. Nothing here
 * reads a clock, so a row says the same thing at midnight and at noon.
 *
 * ============================ AND EMPTY IS AN ANSWER =====================
 *
 * `model === null` is "the read has not landed or failed" and draws the loading
 * or failed state. An empty model is the CLAIM "you are up to date", which is a
 * different sentence and only sayable once the server has said it.
 */

export type ActionCentreBodyProps = {
  /** `null` while the read is out or after it failed — see `status`. */
  readonly model: VNextActionsModel | null
  readonly status: 'idle' | 'loading' | 'ready' | 'failed'
  /**
   * Take the player to the thing. `null` where no destination can be built,
   * which draws the row as a plain item rather than as a dead control.
   */
  readonly onOpenItem?: ((item: VNextActionItem) => void) | undefined
  readonly onDismiss?: ((actionKey: string) => Promise<void>) | undefined
  readonly onRetry?: (() => void) | undefined
}

export function ActionCentreBody({
  model,
  status,
  onOpenItem,
  onDismiss,
  onRetry,
}: ActionCentreBodyProps) {
  if (status === 'failed' && model === null) {
    return (
      <div className={styles.state} data-vnext-actions-state="failed">
        <p className={text.body}>Your updates could not be loaded.</p>
        {onRetry ? (
          <button type="button" className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    )
  }

  if (model === null) {
    return (
      <div className={styles.state} data-vnext-actions-state="loading">
        {/* IT DOES NOT SAY "NOTHING IS WAITING". The read has not answered, and
            reporting an empty inbox before it does is the one claim this panel
            must never make early. */}
        <p className={text.body}>Loading your updates…</p>
      </div>
    )
  }

  const needsYou = actionsNeedingYou(model)
  const news = actionsNews(model)

  if (needsYou.length === 0 && news.length === 0) {
    return (
      <div className={styles.state} data-vnext-actions-state="empty">
        <p className={text.body}>You are up to date.</p>
        <p className={`${text.micro} ${styles.stateDetail}`}>
          Nothing needs you in any of your competitions.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.body}>
      {/* A STALE LIST IS BETTER THAN A BLANK ONE, and it says it is stale. The
          feed already loaded once and a later reload failed, so the rows below
          are the last thing the server actually said. */}
      {status === 'failed' ? (
        <p className={`${text.micro} ${styles.staleNote}`} role="status">
          These may be out of date — the last check did not complete.
        </p>
      ) : null}

      <ActionGroup
        title="Needs you"
        items={needsYou}
        onOpenItem={onOpenItem}
        onDismiss={onDismiss}
      />
      <ActionGroup
        title="Since you were last here"
        items={news}
        onOpenItem={onOpenItem}
        onDismiss={onDismiss}
      />
    </div>
  )
}

/**
 * A GROUP WITH NOTHING IN IT RENDERS NOTHING AT ALL.
 *
 * Not a heading over an empty list. A player with three settled matchweeks and
 * no outstanding work should see one group, because a "Needs you" heading above
 * blank space has to be read every time to learn it has nothing to say — the
 * same rule the attention layer is written under.
 */
function ActionGroup({
  title,
  items,
  onOpenItem,
  onDismiss,
}: {
  readonly title: string
  readonly items: readonly VNextActionItem[]
  readonly onOpenItem?: ((item: VNextActionItem) => void) | undefined
  readonly onDismiss?: ((actionKey: string) => Promise<void>) | undefined
}) {
  const headingId = useId()
  if (items.length === 0) return null

  return (
    <section aria-labelledby={headingId} data-vnext-actions-group={title}>
      <h3 id={headingId} className={`${text.label} ${styles.groupTitle}`}>
        {title}
      </h3>
      <ul className={styles.list}>
        {items.map((item) => (
          <ActionRow
            key={item.key}
            item={item}
            onOpenItem={onOpenItem}
            onDismiss={onDismiss}
          />
        ))}
      </ul>
    </section>
  )
}

function ActionRow({
  item,
  onOpenItem,
  onDismiss,
}: {
  readonly item: VNextActionItem
  readonly onOpenItem?: ((item: VNextActionItem) => void) | undefined
  readonly onDismiss?: ((actionKey: string) => Promise<void>) | undefined
}) {
  const [dismissing, setDismissing] = useState(false)
  const [failed, setFailed] = useState(false)

  // A COMPETITION THE PLAYER'S LIST DOES NOT COVER. It is named as unknown
  // rather than labelled with its tournament id: an id is not a name, and
  // showing one tells the player about a competition the product cannot name.
  const where = item.competitionName ?? 'A competition you play in'

  // THE ACCESSIBLE NAME IS WRITTEN OUT rather than assembled from the text
  // nodes, which would be joined with no separator. Competition and headline
  // stay named apart for the same reason the attention rows keep them apart.
  const label = item.detail === null
    ? `${where}: ${item.headline}`
    : `${where}: ${item.headline}. ${item.detail}`

  // BOTH HALVES, AND BOTH ARE NECESSARY. A host may offer to open rows without
  // every row having somewhere to go — an action in a competition the
  // membership read did not return, or a game this build has no surface for —
  // and drawing those as buttons would give the player a control that does
  // nothing. `actionIsOpenable` is the model's answer to whether a destination
  // exists; the host still owns what the address is.
  const openable = onOpenItem !== undefined && actionIsOpenable(item)

  const content = (
    <span className={styles.rowText}>
      <span className={styles.rowContext}>{where}</span>
      <span className={`${styles.rowHeadline} ${text.emphasis}`}>{item.headline}</span>
      {item.detail === null ? null : (
        <span className={styles.rowDetail}>{item.detail}</span>
      )}
    </span>
  )

  return (
    <li className={styles.item} data-vnext-action-kind={item.kind}>
      <div className={styles.row} data-vnext-action-seen={item.seen ? 'seen' : 'new'}>
        {/* NEW IS A WORD AND NOT ONLY A DOT. A state carried by a coloured mark
            alone is unreadable in greyscale and silent to a screen reader. */}
        {item.seen ? null : (
          <span className={`${text.micro} ${styles.newMark}`}>
            <span aria-hidden="true">●</span>
            <span className={text.srOnly}>Unread. </span>
          </span>
        )}

        {openable ? (
          <button
            type="button"
            className={styles.rowButton}
            aria-label={label}
            onClick={() => onOpenItem(item)}
          >
            {content}
          </button>
        ) : (
          // NOT A DISABLED BUTTON. Where nothing can be opened the row is the
          // information itself, and a greyed control would be a promise of a
          // destination that does not exist.
          <div className={styles.rowStatic}>{content}</div>
        )}

        {onDismiss === undefined ? null : (
          <button
            type="button"
            className={styles.dismiss}
            // IT NAMES WHAT IT DISMISSES. A panel of eight rows produces eight
            // controls that would otherwise all read "Dismiss, button".
            aria-label={`Dismiss: ${item.headline}`}
            disabled={dismissing}
            onClick={() => {
              setDismissing(true)
              setFailed(false)
              // THE ROW LEAVES WHEN THE SERVER SAYS SO. The await is in the
              // hook; this only has to not lie while it is out, and not remove
              // anything itself.
              void onDismiss(item.key)
                .catch(() => setFailed(true))
                .finally(() => setDismissing(false))
            }}
          >
            {dismissing ? 'Dismissing…' : 'Dismiss'}
          </button>
        )}
      </div>

      {failed ? (
        <p className={`${text.micro} ${styles.rowError}`} role="status">
          That could not be dismissed. It is still here.
        </p>
      ) : null}
    </li>
  )
}
