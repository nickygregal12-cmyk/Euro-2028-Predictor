import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Skeleton } from '../../design-system'
import type {
  ProviderReviewQueues,
  ReviewQueueKind,
} from '../../services/supabase/providerReviewQueuesModel'
import { seasonAdminRefusal } from './seasonAdminModel'
import styles from './ProviderReviewPanel.module.css'

/**
 * What the ingestion path recorded and deliberately did nothing about
 * (contract 138).
 *
 * WHY IT MATTERS THAT THIS IS VISIBLE AT ALL. Every one of these queues exists
 * because the platform refused to let a provider decide something: a result it
 * declined to apply, a status token it has no mapping for, a response it could
 * not consume, a kickoff it moved, a window refresh it would not apply. Refusing
 * safely is the right behaviour and it has a cost — the refusals accumulate
 * silently, and "the season never settles" and "there are two hundred unread
 * refusals" are the same fact told twice. Until now the second one was visible
 * only to somebody with database access.
 *
 * ACKNOWLEDGING IS NOT FIXING, and the copy says so rather than implying it.
 * Marking an item reviewed records that a person saw it. It corrects no
 * fixture, applies no result and changes no window; those are the administrator
 * write paths that already own them, and nothing here shortcuts one.
 *
 * TWO THINGS ARE NOT QUEUES AND ARE NOT SHOWN AS QUEUES. Contract 132's staged
 * calendar proposals appear as a count with no acknowledge control, because
 * their lifecycle is approve/reject and a second decision path over the same
 * rows would be exactly the kind of ambiguity the staging exists to remove.
 * Contract 125's result changes are history: no count, no action, and they do
 * not make a season look like it needs attention.
 *
 * IT RELOADS AFTER ACKNOWLEDGING rather than removing rows locally. The server
 * reports how many it actually marked, which can be fewer than were sent when
 * another administrator got there first, and a list that quietly disagreed with
 * that number would be the second copy of the truth this repository keeps
 * removing.
 */

export type ProviderReviewPanelProps = {
  /** Injected by the route; the panel calls no service itself. */
  load: () => Promise<ProviderReviewQueues>
  acknowledge: (kind: ReviewQueueKind, ids: readonly string[]) => Promise<{ marked: number }>
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; message: string }
  | { kind: 'ready'; queues: ProviderReviewQueues }

const TITLES: Record<ReviewQueueKind, string> = {
  result_refusal: 'Results not applied',
  status_observation: 'Unmapped provider statuses',
  consumption: 'Responses not consumed',
  kickoff_revision: 'Kickoffs a provider moved',
  window_conflict: 'Round windows not refreshed',
}

function when(value: string | null): string {
  if (!value) return ''
  const at = new Date(value)
  return Number.isNaN(at.getTime())
    ? ''
    : at.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function ProviderReviewPanel({ load, acknowledge }: ProviderReviewPanelProps) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState<ReviewQueueKind | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    setState({ kind: 'loading' })
    load()
      .then((queues) => {
        if (active) setState({ kind: 'ready', queues })
      })
      .catch((error: unknown) => {
        if (active) setState({ kind: 'failed', message: seasonAdminRefusal(error) })
      })
    return () => {
      active = false
    }
  }, [load, nonce])

  const acknowledgeAll = useCallback(
    async (kind: ReviewQueueKind, ids: readonly string[]) => {
      setBusy(kind)
      setNotice(null)
      try {
        const { marked } = await acknowledge(kind, ids)
        setNotice(
          marked === ids.length
            ? `Marked ${marked} item${marked === 1 ? '' : 's'} reviewed. Nothing was corrected.`
            : // Fewer than asked for is an ordinary outcome, not an error: an
              // item already reviewed elsewhere is simply no longer unreviewed.
              `Marked ${marked} of ${ids.length}. The rest had already been reviewed.`,
        )
        setNonce((value) => value + 1)
      } catch (error: unknown) {
        setNotice(seasonAdminRefusal(error))
      } finally {
        setBusy(null)
      }
    },
    [acknowledge],
  )

  if (state.kind === 'loading') {
    return (
      <section className={styles.panel} aria-busy="true">
        <h2 className={styles.heading}>Provider review</h2>
        <Skeleton height={120} radius="card" />
      </section>
    )
  }

  if (state.kind === 'failed') {
    return (
      <section className={styles.panel}>
        <h2 className={styles.heading}>Provider review</h2>
        <Alert variant="warning" title="These queues could not be read">
          {state.message}
        </Alert>
      </section>
    )
  }

  const { queues } = state

  return (
    <section className={styles.panel} aria-labelledby="provider-review-heading">
      <h2 className={styles.heading} id="provider-review-heading">
        Provider review
      </h2>
      <p className={styles.caption}>
        What ingestion recorded and deliberately did not act on. Marking an item
        reviewed says a person has seen it — it corrects nothing.
      </p>

      {notice ? <Alert variant="info">{notice}</Alert> : null}

      {queues.clear ? (
        <p className={styles.caption}>Nothing is waiting for review in this season.</p>
      ) : null}

      <ul className={styles.list}>
        {queues.queues.map((queue) => (
          <li className={styles.queue} key={queue.kind}>
            <div className={styles.queueHead}>
              <span className={styles.queueName}>
                {TITLES[queue.kind]}
                <span className={styles.count}>{queue.unreviewed}</span>
              </span>
              {queue.items.length > 0 ? (
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() =>
                    void acknowledgeAll(
                      queue.kind,
                      queue.items.map((item) => item.id),
                    )
                  }
                >
                  Mark these reviewed
                </Button>
              ) : null}
            </div>

            {queue.items.length === 0 ? (
              <p className={styles.caption}>Nothing unreviewed.</p>
            ) : (
              <ul className={styles.items}>
                {queue.items.map((item) => (
                  <li className={styles.item} key={item.id}>
                    <span className={styles.summary}>{item.summary}</span>
                    <span className={styles.when}>{when(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* The server counts everything; the read returns a page of it. An
                operator clearing what is on screen must not be told the queue
                is empty when it is not. */}
            {queue.unreviewed > queue.items.length ? (
              <p className={styles.caption}>
                Showing {queue.items.length} of {queue.unreviewed}. Marking these
                reviewed leaves the rest.
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className={styles.footnotes}>
        <p className={styles.caption}>
          {queues.pendingCalendarProposals === 0
            ? 'No provider calendar is staged for approval.'
            : `${queues.pendingCalendarProposals} staged calendar fixtures are waiting for an approve or reject decision, which is a separate action from review and is not offered here.`}
        </p>

        {queues.recentResultChanges.length > 0 ? (
          <>
            <h3 className={styles.subheading}>Recent result changes</h3>
            <p className={styles.caption}>
              History, not a queue — there is nothing to acknowledge.
            </p>
            <ul className={styles.items}>
              {queues.recentResultChanges.map((change) => (
                <li className={styles.item} key={change.id}>
                  <span className={styles.summary}>{change.summary}</span>
                  <span className={styles.when}>{when(change.at)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </section>
  )
}
