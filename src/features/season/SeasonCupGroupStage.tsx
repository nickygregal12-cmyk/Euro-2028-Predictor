import { useEffect, useState } from 'react'
import { Alert, Skeleton } from '../../design-system'
import type {
  CupGroup,
  SeasonCupGroupStage as Stage,
} from '../../services/supabase/seasonCupGroupStageModel'
import styles from './SeasonCupGroupStage.module.css'

/**
 * The Predictor Championship's group stage (contract 167).
 *
 * MULTI-GROUP IS THE POINT. Contract 166 draws the field `launch_season_cup`
 * refused by name, and a field of forty is several groups rather than one long
 * table. So this navigates between them: the caller's group opens first because
 * it is the one they came for, and the others are reachable without leaving.
 * Assuming the first group is the caller's is the defect this avoids — on a
 * multi-group draw it is somebody else's table.
 *
 * NOTHING IS RECOMPUTED OR REORDERED. Group rank, table points and the
 * tie-break inputs are the standings authority's, and `rank` is printed as sent.
 * A row arriving without one was dropped by the decoder rather than placed
 * wherever the array put it.
 *
 * WHAT IS OPPONENT-SAFE HERE. The rows carry a display name, a rank and points
 * — the same facts the competition's own table has always shown its entrants —
 * and no prediction, no scoreline and no pick. There is nothing to conceal
 * because nothing private is in the read.
 *
 * `entered: false` NAMES THE COMPETITION. "You are not in this one" is
 * actionable; an unnamed empty bracket is not.
 */

export type SeasonCupGroupStageProps = {
  read: () => Promise<Stage>
}

type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; stage: Stage }

export function SeasonCupGroupStage({ read }: SeasonCupGroupStageProps) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)
  const [openOrdinal, setOpenOrdinal] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    read()
      .then((stage) => {
        if (active) {
          setState({ status: 'ready', stage })
          // The caller's group opens first. It is the one they came for, and on
          // a multi-group draw the first group in the array is somebody else's.
          setOpenOrdinal(stage.available && stage.entered ? stage.myGroupOrdinal : null)
        }
      })
      .catch(() => {
        if (active) setState({ status: 'failed' })
      })
    return () => {
      active = false
    }
  }, [read, nonce])

  if (state.status === 'loading') {
    return (
      <section className={styles.section} aria-busy="true">
        <h3 className={styles.heading}>Group stage</h3>
        <Skeleton width="100%" height={200} />
      </section>
    )
  }

  if (state.status === 'failed') {
    return (
      <section className={styles.section}>
        <h3 className={styles.heading}>Group stage</h3>
        <Alert variant="warning" title="We could not load the group stage">
          <button type="button" className={styles.retry} onClick={() => setNonce((n) => n + 1)}>
            Try again
          </button>
        </Alert>
      </section>
    )
  }

  const { stage } = state
  if (!stage.available) return null

  if (!stage.entered) {
    return (
      <section className={styles.section}>
        <h3 className={styles.heading}>Group stage</h3>
        <p className={styles.note}>
          You are not in {stage.competition.name}. Its groups are only shown to its entrants.
        </p>
      </section>
    )
  }

  if (stage.groups.length === 0) {
    return (
      <section className={styles.section}>
        <h3 className={styles.heading}>Group stage</h3>
        <p className={styles.note}>
          {stage.competition.name} has not been drawn yet. The groups appear once the organiser
          launches it.
        </p>
      </section>
    )
  }

  const open =
    stage.groups.find((group) => group.ordinal === openOrdinal) ?? stage.groups[0]!

  return (
    <section className={styles.section} aria-labelledby="cup-groups-heading">
      <h3 className={styles.heading} id="cup-groups-heading">
        Group stage
      </h3>
      <p className={styles.note}>
        {stage.groupCount} {stage.groupCount === 1 ? 'group' : 'groups'}
        {stage.matchdays ? ` · ${stage.matchdays} matchdays` : ''}
        {stage.myGroupOrdinal === null ? ' · you hold no group' : ''}
      </p>

      {stage.groups.length > 1 ? (
        <div className={styles.tabs} role="tablist" aria-label="Groups">
          {stage.groups.map((group) => (
            <button
              key={group.groupId}
              type="button"
              role="tab"
              id={`cup-group-tab-${group.ordinal}`}
              aria-selected={group.ordinal === open.ordinal}
              aria-controls={`cup-group-panel-${group.ordinal}`}
              className={`${styles.tab} ${group.ordinal === open.ordinal ? styles.tabOn : ''}`}
              onClick={() => setOpenOrdinal(group.ordinal)}
            >
              Group {group.ordinal}
              {group.isMyGroup ? <span className={styles.yours}>Yours</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      <GroupTable group={open} multi={stage.groups.length > 1} />
    </section>
  )
}

function GroupTable({ group, multi }: { group: CupGroup; multi: boolean }) {
  return (
    <div
      className={styles.scroller}
      role={multi ? 'tabpanel' : undefined}
      id={multi ? `cup-group-panel-${group.ordinal}` : undefined}
      aria-labelledby={multi ? `cup-group-tab-${group.ordinal}` : undefined}
    >
      <table className={styles.table}>
        <caption className={styles.caption}>
          Group {group.ordinal}
          {group.isMyGroup ? ' — your group' : ''} · {group.size}{' '}
          {group.size === 1 ? 'entrant' : 'entrants'}
        </caption>
        <thead>
          <tr>
            <th scope="col" className={styles.pos}>
              <abbr title="Rank">#</abbr>
            </th>
            <th scope="col" className={styles.who}>
              Player
            </th>
            <th scope="col">
              <abbr title="Table points">Pts</abbr>
            </th>
            <th scope="col" className={styles.wide}>
              <abbr title="Points for">PF</abbr>
            </th>
            <th scope="col" className={styles.wide}>
              <abbr title="Points against">PA</abbr>
            </th>
            <th scope="col" className={styles.wide}>
              <abbr title="Exact scores">Exact</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => (
            <tr key={row.userId} className={row.isMe ? styles.me : undefined}>
              <td className={styles.pos}>{row.rank}</td>
              <th scope="row" className={styles.who}>
                {row.displayName}
                {row.isMe ? <span className={styles.youTag}>You</span> : null}
              </th>
              <td className={styles.pts}>{row.tablePoints}</td>
              <td className={styles.wide}>{row.pointsFor}</td>
              <td className={styles.wide}>{row.pointsAgainst}</td>
              <td className={styles.wide}>{row.exacts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
