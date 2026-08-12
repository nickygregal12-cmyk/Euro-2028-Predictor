import { useId } from 'react'
import { ordinal } from '../league/ordinal'
import {
  describeBranch,
  presentWhatIf,
  type WhatIfBranch,
  type WhatIfLeagueBlock,
} from './whatIfModel'
import type { SeasonMatchweekProjection } from '../../services/supabase/seasonMatchweekProjectionModel'
import styles from './SeasonMatchWhatIf.module.css'

/**
 * `INNOV-001` — What-If, on the fixture it is about, from contract 175.
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
 * THE NUMBER ON EACH BRANCH IS THE WHOLE MATCHWEEK. That is what contract 175
 * returns, post-Joker, from the authority settlement banks from — so a branch
 * reads "68 projected pts" for the matchweek and the change beneath it, rather
 * than a per-fixture figure that a Joker would silently make wrong.
 *
 * IT DISAPPEARS RATHER THAN EXPLAINS ITSELF when there is nothing to project.
 * A settled matchweek, a fixture with a confirmed result, or a fixture with no
 * provider score at all renders nothing: an empty projection panel on every
 * unplayed fixture in the calendar would be noise on the surface a player uses
 * most.
 *
 * THE LEAGUE HALF IS THE SERVER'S AND IS "AS IT STANDS". Contract 175 hides it
 * completely before the matchweek's own lock, so this panel cannot show a rival
 * earlier than the reveal rule allows — it has nothing to show. After the lock
 * the block is the projection under the CURRENT basis, and it is labelled that
 * way rather than being repeated under each hypothetical: the server does not
 * project a league under a branch, and rebuilding one here would put a rival's
 * points back in the browser.
 *
 * ON A PHONE IT IS THREE STACKED ROWS AND ON A DESKTOP THREE COLUMNS, which is
 * one grid rather than two components. The branches are genuinely parallel, so
 * side-by-side is the right shape wherever there is room for it.
 */

export type SeasonMatchWhatIfProps = {
  projection: SeasonMatchweekProjection
  fixtureId: string
  homeName: string
  awayName: string
}

export function SeasonMatchWhatIf({
  projection,
  fixtureId,
  homeName,
  awayName,
}: SeasonMatchWhatIfProps) {
  const headingId = useId()
  const view = presentWhatIf(projection, fixtureId, homeName, awayName)

  // Settled, not started, or a fixture this projection does not carry: all of
  // them are "there is nothing to say", and none is worth a card.
  if (!view.available) return null

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        Projection
      </h2>
      <p className={styles.lede}>
        {homeName} {view.live.home} – {view.live.away} {awayName} is what a provider is reporting
        now.{' '}
        {view.prediction
          ? `You predicted ${view.prediction.home} – ${view.prediction.away}.`
          : 'You have no prediction on this fixture.'}
      </p>

      <ul className={styles.branches}>
        {view.branches.map((branch) => (
          <Branch key={branch.key} branch={branch} jokerPlayed={view.jokerPlayed} />
        ))}
      </ul>

      {view.league ? <LeagueConsequence league={view.league} matchweek={view.matchweek} /> : null}

      <p className={styles.caveat}>
        Projected, never awarded. A provisional score can change or be withdrawn, and nothing counts
        until the platform confirms the result.
        {view.jokerPlayed ? ' Your Joker is already applied to every figure here.' : ''}
      </p>
    </section>
  )
}

function Branch({ branch, jokerPlayed }: { branch: WhatIfBranch; jokerPlayed: boolean }) {
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
        {branch.reason === 'exact_score' ? <span className={styles.exactTag}>Exact</span> : null}
        {branch.matchweekPoints} projected {branch.matchweekPoints === 1 ? 'pt' : 'pts'}
      </span>
      <span className={styles.branchNote}>
        {/* The scope of the figure above, said once per branch. "68 pts" beside
            a single fixture would otherwise read as this fixture's points. */}
        Matchweek total{jokerPlayed ? ', Joker applied' : ''}
      </span>
      <span className={styles.branchNote}>{describeBranch(branch)}</span>
    </li>
  )
}

function LeagueConsequence({
  league,
  matchweek,
}: {
  league: WhatIfLeagueBlock
  matchweek: number
}) {
  if (!league.revealed) {
    // Hidden by rule, and named as that rather than as empty or failed. The
    // server carried no member rows at all, so there is nothing being withheld
    // on screen either.
    return (
      <p className={styles.leagueNote}>
        <span className={styles.leagueName}>{league.leagueName}</span> — league projections open
        when matchweek {matchweek} locks.
      </p>
    )
  }

  const you = league.you

  return (
    <div className={styles.league}>
      <span className={styles.leagueName}>{league.leagueName}</span>
      {you === null ? (
        <span className={styles.leagueNote}>You are not in this league&rsquo;s projection.</span>
      ) : (
        <span className={styles.leagueNote}>
          Projected {ordinal(you.projectedRank)}
          {league.membersTotal !== null ? ` of ${league.membersTotal}` : ''}
          {you.projectedRank !== you.currentRank
            ? ` · ${you.projectedRank < you.currentRank ? 'up' : 'down'} from ${ordinal(you.currentRank)}`
            : ' · no change'}
          {league.gapToLeader !== null && league.gapToLeader > 0 && league.leaderName
            ? ` · ${league.gapToLeader} behind ${league.leaderName}`
            : league.gapToLeader === 0
              ? ' · level at the top'
              : ''}
        </span>
      )}
      {/* The bound, stated. A projection of the whole league beside a truncated
          list reads as though every member had been accounted for. */}
      {league.membersTruncated ? (
        <span className={styles.leagueNote}>
          Showing {league.membersReturned}
          {league.membersTotal !== null ? ` of ${league.membersTotal}` : ''} members.
        </span>
      ) : null}
      <span className={styles.leagueNote}>
        As the matchweek stands. This is not projected forward from the next goal.
      </span>
    </div>
  )
}
