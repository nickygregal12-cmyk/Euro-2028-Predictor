import { useId } from 'react'
import type { MatchesFilter, MatchesModel, MatchesScope } from '../models/matches'
import { ScopeMarker } from '../components/navigation/ScopeMarker'
import text from '../foundations/typography.module.css'
import styles from './matches.module.css'

const FILTER_LABELS: Readonly<Record<MatchesFilter, string>> = {
  all: 'All',
  live: 'Live',
  upcoming: 'Upcoming',
  finished: 'Finished',
}

const FILTER_ORDER: readonly MatchesFilter[] = ['all', 'live', 'upcoming', 'finished']

export type MatchesBrowseProps = {
  readonly model: MatchesModel
  readonly filter: MatchesFilter
  readonly onFilter: (filter: MatchesFilter) => void
  readonly onScope: (scope: MatchesScope) => void
}

/**
 * THE BROWSING CONTROLS: what football, and whose.
 *
 * ============================ ONLY REAL FOOTBALL JOBS ====================
 *
 * Four filters and one scope. There is no sort-by-column, no provider metadata,
 * no advanced search and no odds — §13, and the reason is that every control
 * here costs a player attention on a page whose job is to be scanned. "Live",
 * "Upcoming" and "Finished" are the three questions a person actually asks a
 * fixture list; everything else is a database talking.
 *
 * ============================ A FILTER WITH NOTHING IN IT =================
 *
 * A filter whose count is zero is DISABLED and says its count, rather than
 * being hidden. Hiding it would make the control row change shape as football
 * happens — the "Live" tab appearing and disappearing under the player's thumb
 * — and a disabled tab that says "0" answers the question ("is anything live?")
 * without being pressed.
 *
 * ============================ THE SCOPE CONTROL ==========================
 *
 * IT RENDERS NOTHING AT ONE COMPETITION. Exactly the rule the shell applies to
 * its switcher, and for the same reason: a control offering one choice teaches
 * a player there is a decision and then spends their press proving there is
 * not. `combinedAvailable` is false for a one-competition player AND for a host
 * that cannot answer a cross-competition calendar — an offered mode that
 * refuses is worse than an absent one.
 *
 * COMPETITION IS THE DEFAULT AND IS NAMED FIRST. The combined mode is a layer
 * over a competition-rooted product, never the landing state, and the control's
 * order says so.
 */
export function MatchesBrowse({ model, filter, onFilter, onScope }: MatchesBrowseProps) {
  const scopeGroup = useId()

  return (
    <div className={styles.browse} data-vnext-zone="browse">
      {model.scope.combinedAvailable ? (
        <div
          className={styles.scope}
          role="group"
          aria-label="Which football to show"
          data-vnext-matches-scope={model.scope.active}
        >
          <button
            type="button"
            className={styles.scopeOption}
            aria-pressed={model.scope.active === 'competition'}
            onClick={() => onScope('competition')}
          >
            {model.scope.active === 'competition' ? <ScopeMarker group={scopeGroup} /> : null}
            <span className={styles.scopeLabel}>In {model.competition.shortName}</span>
          </button>
          <button
            type="button"
            className={styles.scopeOption}
            aria-pressed={model.scope.active === 'combined'}
            onClick={() => onScope('combined')}
          >
            {model.scope.active === 'combined' ? <ScopeMarker group={scopeGroup} /> : null}
            <span className={styles.scopeLabel}>
              Across your {model.scope.competitionCount} competitions
            </span>
          </button>
        </div>
      ) : null}

      <div className={styles.filters} role="group" aria-label="Filter matches">
        {FILTER_ORDER.map((option) => {
          const count = model.counts[option]
          const empty = count === 0 && option !== 'all'
          return (
            <button
              key={option}
              type="button"
              className={styles.filter}
              // A TAB THAT HAS GONE INERT IS NOT THE CHOSEN ONE. A model rebuilt
              // while `Live` was selected can take that count to zero, and a
              // control that is both `disabled` and `aria-pressed="true"`
              // announces as the current choice while refusing to be one.
              aria-pressed={!empty && filter === option}
              // A tab with nothing behind it is inert rather than absent, so the
              // control row does not change shape while the player is using it.
              disabled={empty}
              data-vnext-matches-filter={option}
              onClick={() => onFilter(option)}
            >
              <span>{FILTER_LABELS[option]}</span>
              <span className={`${styles.filterCount} ${text.numeric}`}>{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * WHERE IN THE COMPETITION'S OWN STRUCTURE THIS WINDOW SITS.
 *
 * THE LABELS ARE THE SERVER'S AND ARE PRINTED VERBATIM. "Matchweek 7",
 * "Quarter-finals", "Group A · Matchday 2" — a domestic league, a knockout and
 * a group stage name their own rounds, and nothing here counts anything or
 * turns an ordinal into a word. That is §10's requirement, and it is why this
 * is a SUMMARY rather than a matchweek stepper: a stepper would have to know
 * what "the next one" is called, which is exactly the knowledge presentation
 * does not have.
 *
 * It renders nothing when the window holds one stage, because saying
 * "Matchweek 4" over a page of Matchweek 4 fixtures that each already say so is
 * noise on the most common day of all.
 */
export function MatchesStageSummary({ model }: { readonly model: MatchesModel }) {
  if (model.stages.length < 2) return null

  return (
    <div className={styles.stages} data-vnext-zone="stages">
      <p className={`${text.label} ${styles.stagesTitle}`}>In this window</p>
      <ul className={styles.stageList}>
        {model.stages.map((stage) => (
          <li key={stage.id} className={styles.stageRow}>
            <span className={styles.stageLabel}>{stage.label}</span>
            <span className={`${styles.stageCount} ${text.numeric}`}>{stage.matches}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
