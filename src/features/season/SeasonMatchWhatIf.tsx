import { useId } from 'react'
import { ordinal } from '../league/ordinal'
import {
  describeBranch,
  projectWhatIf,
  type WhatIfBranch,
  type WhatIfInput,
  type WhatIfLeagueProjection,
} from './whatIfModel'
import styles from './SeasonMatchWhatIf.module.css'

/**
 * `INNOV-001` — What-If, on the fixture it is about.
 *
 * IT IS PART OF THE MATCH CENTRE AND NOT A NOVELTY PAGE. The question it
 * answers — what does the next goal do to me — only exists beside the score it
 * is asking about, and a separate route would be somewhere a player goes once.
 *
 * EVERY FIGURE CARRIES THE WORD "PROJECTED", AND THE PANEL SAYS SO ONCE MORE AT
 * THE FOOT. Provisional scores move; a projection built on one is not a point
 * and must never be mistaken for one. The heading says Projection, each branch
 * says projected, and nothing here is rendered in the same place, colour or
 * shape as the confirmed points above it.
 *
 * IT DISAPPEARS RATHER THAN EXPLAINS ITSELF when there is nothing to project.
 * A fixture with a confirmed result, or with no provider score at all, renders
 * nothing: an empty projection panel on every unplayed fixture in the calendar
 * would be noise on the surface a player uses most.
 *
 * THE LEAGUE HALF IS DERIVED FROM WHAT THE SERVER ALREADY REVEALED. It uses
 * contract 149's league matchweek predictions, which carry no member rows at
 * all before the matchweek's own lock, so this panel cannot show a prediction
 * earlier than the reveal rule allows — it has none to show.
 *
 * ON A PHONE IT IS THREE STACKED ROWS AND ON A DESKTOP THREE COLUMNS, which is
 * one grid rather than two components. The branches are genuinely parallel, so
 * side-by-side is the right shape wherever there is room for it.
 */

export type SeasonMatchWhatIfProps = {
  input: WhatIfInput
}

export function SeasonMatchWhatIf({ input }: SeasonMatchWhatIfProps) {
  const headingId = useId()
  const projection = projectWhatIf(input)

  // Settled, not started, or a score this module will not project from: all
  // three are "there is nothing to say", and none of them is worth a card.
  if (!projection.available) return null

  const anyLeague = projection.branches.some((branch) => branch.league !== null)

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        Projection
      </h2>
      <p className={styles.lede}>
        {input.homeName} {projection.live.home} – {projection.live.away} {input.awayName} is what a
        provider is reporting now.{' '}
        {projection.prediction
          ? `You predicted ${projection.prediction.home} – ${projection.prediction.away}.`
          : 'You have no prediction on this fixture.'}
      </p>

      <ul className={styles.branches}>
        {projection.branches.map((branch) => (
          <Branch key={branch.key} branch={branch} />
        ))}
      </ul>

      <p className={styles.caveat}>
        Projected, never awarded. A provisional score can change or be withdrawn, and nothing counts
        until the platform confirms the result.
        {anyLeague ? ' League positions here are projections too, not the table.' : ''}
      </p>
    </section>
  )
}

function Branch({ branch }: { branch: WhatIfBranch }) {
  return (
    <li className={styles.branch} data-branch={branch.key}>
      <span className={styles.branchLabel}>{branch.label}</span>
      <span className={styles.branchScore}>{branch.scoreLabel}</span>
      <span
        className={styles.branchPoints}
        // Marked as well as coloured: an exact score must not be distinguished
        // by colour alone (design system §11.8).
        data-reason={branch.reason}
      >
        {branch.reason === 'exact_score' ? (
          <span className={styles.exactTag}>Exact</span>
        ) : null}
        {branch.points} projected {branch.points === 1 ? 'pt' : 'pts'}
      </span>
      <span className={styles.branchNote}>{describeBranch(branch)}</span>
      {branch.league ? <LeagueConsequence league={branch.league} /> : null}
    </li>
  )
}

function LeagueConsequence({ league }: { league: WhatIfLeagueProjection }) {
  const you = league.you

  return (
    <span className={styles.league}>
      <span className={styles.leagueName}>{league.leagueName}</span>
      {you === null ? (
        <span className={styles.leagueNote}>You are not in this matchweek&rsquo;s predictions.</span>
      ) : you.projectedRank === null ? (
        // Season totals were not available, so a rank cannot be projected. The
        // matchweek figure still can be, and saying only that is better than
        // inventing the half that is missing.
        <span className={styles.leagueNote}>
          {you.matchweekPoints} projected {you.matchweekPoints === 1 ? 'pt' : 'pts'} this matchweek.
          Your league position cannot be projected here.
        </span>
      ) : (
        <span className={styles.leagueNote}>
          Projected {ordinal(you.projectedRank)} of {league.memberCount}
          {league.gapToLeader !== null && league.gapToLeader > 0 && league.leaderName
            ? ` · ${league.gapToLeader} behind ${league.leaderName}`
            : league.gapToLeader === 0
              ? ' · level at the top'
              : ''}
        </span>
      )}
      {league.unknownFixtures > 0 ? (
        // The bound, stated. A projection that silently ignores four unplayed
        // fixtures reads as though it had accounted for them.
        <span className={styles.leagueNote}>
          {league.unknownFixtures} other{' '}
          {league.unknownFixtures === 1 ? 'fixture is' : 'fixtures are'} not settled and count
          nothing for anybody yet.
        </span>
      ) : null}
    </span>
  )
}
