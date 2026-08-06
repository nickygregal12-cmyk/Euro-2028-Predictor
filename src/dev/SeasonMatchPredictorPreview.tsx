import { useMemo, useState } from 'react'
import { SeasonMatchPredictorPage } from '../features/season/SeasonMatchPredictorPage'
import { journeyImplementation } from '../app/routeFlags'
import {
  createSeasonMatchPredictorGateway,
  type GatewayScenario,
} from './seasonMatchPredictorGateway'
import { MATCHWEEK_COUNT, instantFor } from './seasonPreviewFixture'
import styles from './SeasonMatchPredictorPreview.module.css'

/**
 * DEV harness for the season Match Predictor: every state, driven deliberately.
 *
 * WHY THIS SURVIVES THE PRODUCTION ROUTE. The page is now registered at
 * `/competitions/:competitionSlug/:seasonSlug/main-predictor`, so this is no
 * longer the only way to see it — but it is still the only way to see all of
 * it. The real route shows the state the database happens to be in; this shows
 * every state on demand, including the three that are hard to produce
 * deliberately (a save failure, a version conflict, and a published matchweek
 * with no fixtures) and the clock positions on either side of a lock. Deleting
 * it would trade six reachable states for one.
 *
 * The flag that selects the production route is read below —
 * `VITE_UI_SEASON_MATCH_PREDICTOR`. This harness reports which implementation
 * it currently selects, so the rollback switch stays observable.
 */

const SCENARIOS: readonly { id: GatewayScenario; label: string; hint: string }[] = [
  { id: 'healthy', label: 'Healthy', hint: 'Open matchweek, saves succeed' },
  { id: 'slow', label: 'Slow', hint: 'Delayed load and saves — shows the skeleton' },
  { id: 'load_failure', label: 'Load failure', hint: 'The matchweek cannot be read' },
  { id: 'save_failure', label: 'Save failure', hint: 'Saves fail and retry' },
  { id: 'version_conflict', label: 'Conflict', hint: 'Edited on another device' },
  { id: 'no_fixtures', label: 'No fixtures', hint: 'Published matchweek with an empty card' },
]

const OFFSETS: readonly { label: string; minutes: number; hint: string }[] = [
  { label: 'Before lock', minutes: -180, hint: 'Three hours before first kickoff' },
  { label: 'At lock', minutes: 0, hint: 'First kickoff reached' },
  { label: 'After lock', minutes: 120, hint: 'Two hours after first kickoff' },
]

export function SeasonMatchPredictorPreview() {
  const [scenario, setScenario] = useState<GatewayScenario>('healthy')
  const [offsetMinutes, setOffsetMinutes] = useState(-180)
  const [matchweek, setMatchweek] = useState(1)
  const [touched, setTouched] = useState(false)

  const gateway = useMemo(
    () =>
      createSeasonMatchPredictorGateway({
        scenario,
        now: instantFor(matchweek, offsetMinutes),
        cardStatus: touched ? 'provisional' : 'no_submission',
      }),
    [scenario, offsetMinutes, matchweek, touched],
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Season Match Predictor — /dev/season-predictor</h1>
        <p className={styles.sub}>
          Real rules, synthetic data. The flag <code>VITE_UI_SEASON_MATCH_PREDICTOR</code> currently
          selects: <strong>{journeyImplementation('seasonMatchPredictor')}</strong>.
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

        <fieldset className={styles.group}>
          <legend>Clock</legend>
          {OFFSETS.map((option) => (
            <label key={option.label} className={styles.option}>
              <input
                type="radio"
                name="offset"
                checked={offsetMinutes === option.minutes}
                onChange={() => setOffsetMinutes(option.minutes)}
              />
              <span>
                {option.label} <em>{option.hint}</em>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.group}>
          <legend>Card</legend>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={touched}
              onChange={(event) => setTouched(event.target.checked)}
            />
            <span>
              Already engaged <em>Unbanked when off, banks entries when on</em>
            </span>
          </label>
          <label className={styles.option}>
            <span>Matchweek</span>
            <input
              type="number"
              min={1}
              max={MATCHWEEK_COUNT}
              value={matchweek}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isInteger(next) && next >= 1 && next <= MATCHWEEK_COUNT) {
                  setMatchweek(next)
                }
              }}
            />
          </label>
        </fieldset>
      </div>

      <div className={styles.themes}>
        <section data-theme="dark" className={styles.panel}>
          <div className={styles.panelTag}>Dark</div>
          <SeasonMatchPredictorPage gateway={gateway} matchweek={matchweek} />
        </section>
        <section data-theme="light" className={styles.panel}>
          <div className={styles.panelTag}>Light</div>
          <SeasonMatchPredictorPage gateway={gateway} matchweek={matchweek} />
        </section>
      </div>
    </div>
  )
}
