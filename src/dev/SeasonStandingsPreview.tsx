import { useMemo, useState } from 'react'
import { SeasonStandingsPage } from '../features/season/SeasonStandingsPage'
import {
  createDevSeasonStandingsGateway,
  type StandingsScenario,
} from './seasonStandingsGateway'
import styles from './SeasonMatchPredictorPreview.module.css'

/**
 * DEV harness for the season standings surface: every state, driven on purpose.
 *
 * Shares `SeasonMatchPredictorPreview`'s stylesheet rather than copying it. The
 * two harnesses are the same object — controls above, dark and light panels
 * below — and a second stylesheet would drift from the first the moment either
 * changed.
 *
 * WHY THE PRODUCTION ROUTE STILL WAITS, even though this table's RPC is real
 * and granted. The standings belong to the season Match Predictor, and that
 * game has no production route yet: its own read path (contract 114) is merged
 * but not applied to hosted development, so registering standings now would
 * put a table in the navigation for a game the player cannot reach. The order
 * is game first, then its table.
 */

const SCENARIOS: readonly { id: StandingsScenario; label: string; hint: string }[] = [
  { id: 'healthy', label: 'Healthy', hint: 'A settled table with the caller in it' },
  { id: 'you_off_page', label: 'You off page', hint: '400 players, caller 399th — pinned below' },
  { id: 'ties', label: 'Ties', hint: 'A three-way tie showing shared ranks' },
  { id: 'empty', label: 'Empty', hint: 'Before the first matchweek settles' },
  { id: 'slow', label: 'Slow', hint: 'Delayed load — shows the skeleton' },
  { id: 'load_failure', label: 'Load failure', hint: 'The table cannot be read' },
  { id: 'page_failure', label: 'Page failure', hint: 'First page loads, "load more" fails' },
]

export function SeasonStandingsPreview() {
  const [scenario, setScenario] = useState<StandingsScenario>('healthy')
  const gateway = useMemo(() => createDevSeasonStandingsGateway(scenario), [scenario])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Season standings — /dev/season-standings</h1>
        <p className={styles.sub}>
          The real <code>get_season_leaderboard</code> shape, synthetic data. Ranking, ordering and
          ties come from the server in production; this surface only presents them.
        </p>
      </header>

      <div className={styles.controls}>
        <fieldset className={styles.group}>
          <legend>Scenario</legend>
          {SCENARIOS.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="radio"
                name="scenario"
                checked={scenario === option.id}
                onChange={() => setScenario(option.id)}
              />
              <span>
                {option.label} <em>{option.hint}</em>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.themes}>
        <section data-theme="dark" className={styles.panel}>
          <div className={styles.panelTag}>Dark</div>
          <SeasonStandingsPage gateway={gateway} gameName="Match Predictor" />
        </section>
        <section data-theme="light" className={styles.panel}>
          <div className={styles.panelTag}>Light</div>
          <SeasonStandingsPage gateway={gateway} gameName="Match Predictor" />
        </section>
      </div>
    </div>
  )
}
