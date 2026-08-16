import type { ActivityItem, HomeModel } from '../../models/home'
import { formatTime } from '../../foundations/format'
import typography from '../../foundations/typography.module.css'
import styles from './command.module.css'

export type CommandWireProps = {
  model: HomeModel
}

const KIND_LABEL: Record<ActivityItem['kind'], string> = {
  predictionSettled: 'Settled',
  rankChange: 'Rank',
  rivalMove: 'Rival',
  liveEvent: 'Live',
  leagueInvite: 'Invite',
  deadline: 'Deadline',
}

/**
 * The wire: what changed, newest first.
 *
 * This is the "what changed" half of the concept's four questions, and it is
 * the only zone on the page that mixes football, rivals and the user's own
 * standing in one list — because that is what "what happened while I was away"
 * actually looks like.
 *
 * Emphasis comes from the model rather than from arithmetic on a points value,
 * and it is always paired with a written kind ("Rival", "Deadline") and a time,
 * so no item is distinguishable only by its colour.
 */
export function CommandWire({ model }: CommandWireProps) {
  return (
    <div className={styles.panel}>
      <header className={styles.panelHead}>
        <h2 className={`${typography.label} ${styles.panelTitle}`}>The wire</h2>
        <p className={typography.micro}>Since this morning</p>
      </header>

      <ol className={styles.wireList}>
        {model.activity.map((item) => (
          <li key={item.id} className={`${styles.wireItem} ${toneClass(item)}`}>
            <span className={styles.wireMeta}>
              <span className={`${styles.wireKind} ${typography.label}`}>
                {KIND_LABEL[item.kind]}
              </span>
              <span className={`${styles.wireTime} ${typography.numeric}`}>
                {formatTime(item.occurredAt)}
              </span>
            </span>
            <span className={styles.wireBody}>
              <span className={`${typography.body} ${styles.wireHeadline}`}>
                {item.headline}
              </span>
              {item.detail ? (
                <span className={`${typography.micro} ${styles.wireDetail}`}>
                  {item.detail}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function toneClass(item: ActivityItem): string {
  if (item.emphasis === 'positive') return styles.wirePositive
  if (item.emphasis === 'negative') return styles.wireNegative
  return styles.wireNeutral
}
