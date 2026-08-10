import { useMemo, useState } from 'react'
import { SeasonCupPhasePage } from '../features/season/SeasonCupPhasePage'
import { createDevSeasonCupGateway, type CupScenario } from './seasonCupGateway'
import styles from './SeasonMatchPredictorPreview.module.css'

/**
 * DEV harness for the Predictor Championship phase.
 *
 * Shares the Match Predictor harness's stylesheet rather than copying it: the
 * harnesses are the same object — controls above, dark and light panels below.
 *
 * The scenario that matters most is `split`. The phase-transition driver that
 * would populate a real split group is still unbuilt, so until it lands this
 * harness is the only place the split rendering can be reviewed — and the
 * thing to review is that it reads as a continuation, never an elimination.
 */

const SCENARIOS: readonly { id: CupScenario; label: string; hint: string }[] = [
  { id: 'initial', label: 'League phase', hint: 'Six entrants, you third' },
  { id: 'split', label: 'Split', hint: 'Narrower field — must NOT read as elimination' },
  { id: 'tied_ranks', label: 'Tied ranks', hint: 'Two rows the authority ranked level' },
  { id: 'empty_table', label: 'No table', hint: 'Entered, nothing settled yet' },
  { id: 'not_entered', label: 'Not entered', hint: 'The contract answers entered=false' },
  { id: 'load_failed', label: 'Load failed', hint: 'A failure is never an empty table' },
]

export function SeasonCupPreview() {
  const [scenario, setScenario] = useState<CupScenario>('initial')
  const gateway = useMemo(() => createDevSeasonCupGateway(scenario), [scenario])

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.h1}>Predictor Championship — /dev/season-cup</h1>
        <p className={styles.sub}>
          The contract-120 payload shape, synthetic data. Opponents appear as entrants at a
          rank — the read discloses no name, and neither does the surface.
        </p>
      </header>

      <div className={styles.controls} data-harness>
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
          <SeasonCupPhasePage gateway={gateway} />
        </section>
        <section data-theme="light" className={styles.panel}>
          <div className={styles.panelTag}>Light</div>
          <SeasonCupPhasePage gateway={gateway} />
        </section>
      </div>
    </div>
  )
}
