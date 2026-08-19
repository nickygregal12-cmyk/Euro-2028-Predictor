import type {
  BracketPanel,
  PenaltyNumberPanel,
  BracketSeat,
  BracketSide,
  ChampionshipPageModel,
  ChampionshipStanding,
  GroupPanel,
  TieOutcome,
} from '../../models/championship'
import type { CupBracketSeat, CupSeatSide } from '../../../services/supabase/seasonCupBracket'
import type { ChampionshipSource } from './championshipSource'

/**
 * `ChampionshipSource` → `ChampionshipPageModel`. PURE: no network, no storage,
 * no clock and no React.
 *
 * ============================ IT BUILDS NO BRACKET =======================
 *
 * The stage's headline predicate is that a Championship be understandable
 * "without reconstructing its bracket in React", and this is the file that
 * would do the reconstructing if anything did. It does not:
 *
 *   • it pairs no opponents — a seat arrives with both sides already in it;
 *   • it computes no round count, seat position or slot;
 *   • it sorts nothing. Contract 193 orders `by window_sequence, bracket_slot`
 *     and that order is carried through untouched;
 *   • it infers no bye. A seat with one side empty is rendered as a seat with
 *     one side empty, and the reason it is empty is not this lane's to state.
 *
 * ============================ IT DERIVES NO ELIMINATION ==================
 *
 * `standing` is `not-stated` unless an authority stated it, and today none
 * does. The inference this refuses — "a settled tie you did not win, with no
 * later tie" — is wrong whenever a competition has not finished eliminating,
 * and it is exactly the class of derivation Stage 11's reviews caught three
 * times over.
 *
 * ============================ AND IT INVENTS NO FOOTBALL =================
 *
 * A settled tie carries a `decision` and no numbers. There is no arithmetic
 * anywhere in this file over points, scores or seeds.
 */

function sideOf(side: CupSeatSide, youId: string | null): BracketSide {
  // NULL IS AN EMPTY SEAT, decided in the decoder by `user_id` rather than by
  // the display name — which contract 193 coalesces to 'Player' for a hole and
  // for a nameless person alike.
  if (side === null) return { kind: 'empty' }
  return {
    kind: 'player',
    displayName: side.displayName,
    isYou: youId !== null && side.userId === youId,
  }
}

/**
 * WHAT HAPPENED TO A TIE, WITH NO ROOM FOR A SCORE.
 *
 * `winnerIsHome` is null where the winner is neither named side — which is a
 * state rather than an error, and is not resolved by guessing.
 */
function outcomeOf(seat: CupBracketSeat): TieOutcome {
  if (seat.winnerUserId === null || seat.decidedBy === null) return { kind: 'unsettled' }
  const winnerIsHome =
    seat.home !== null && seat.home.userId === seat.winnerUserId
      ? true
      : seat.away !== null && seat.away.userId === seat.winnerUserId
        ? false
        : null
  return {
    kind: 'settled',
    decision: seat.decidedBy,
    winnerIsHome,
    // Contract 193's `bracket[]` carries no `settled_at`; `my_ties[]` does.
    settledAt: null,
  }
}

function seatOf(seat: CupBracketSeat, youId: string | null): BracketSeat {
  return {
    // A FACT ABOUT THE ROW, not an address: contract 193's own fixture id.
    key: seat.fixtureId,
    windowSequence: seat.windowSequence,
    windowLabel: seat.windowLabel,
    roundSize: seat.roundSize,
    bracketSlot: seat.bracketSlot,
    home: sideOf(seat.home, youId),
    away: sideOf(seat.away, youId),
    isYours: seat.isYours,
    outcome: outcomeOf(seat),
  }
}

function bracketPanelOf(source: ChampionshipSource): BracketPanel {
  if (source.bracket.kind !== 'ok') return { kind: 'unavailable' }

  const answer = source.bracket.bracket
  if (!answer.entered) return { kind: 'not-entered' }

  // BOTH HALVES ARE LOAD-BEARING, and neither is redundant.
  //
  // `drawn` is BROADER THAN ITS NAME. Contract 193 computes it as
  // `exists(fixture.stage <> 'group')`, not `exists(knockout)` — so a
  // `single_group` competition that has merely reached its SPLIT reports
  // `drawn: true` with no knockout in existence.
  //
  // The seat list is what corrects it: the decoder drops `split` fixtures, so
  // that competition arrives with zero seats. Trusting `drawn` alone would show
  // it an empty bracket; trusting the length alone would call a genuinely drawn
  // competition undrawn while its own view of the draw filtered to nothing.
  if (!answer.qualification.drawn || answer.bracket.length === 0) {
    return { kind: 'not-drawn' }
  }

  // WHO "YOU" ARE, read from the server rather than derived. `is_yours` marks
  // the SEAT; it does not say which SIDE of it the caller is. Contract 193
  // answers that separately, per fixture, with `my_ties[].is_home` — and it
  // answers it for SETTLED ties as well, which is why this survives the final:
  // `my_tie` filters `winner_user_id is null`, so it is null for a champion,
  // but their won final is still in `my_ties`.
  //
  // Pairing one of the caller's own ties with its seat by `fixture_id` names
  // the caller outright. No subtraction, no id passed in, no guess. Where the
  // caller holds no tie at all, null remains the honest answer.
  const youId = ((): string | null => {
    for (const tie of answer.myTies) {
      const seat = answer.bracket.find((row) => row.fixtureId === tie.fixtureId)
      if (seat === undefined) continue
      const mine = tie.isHome ? seat.home : seat.away
      if (mine !== null) return mine.userId
    }
    return null
  })()

  return {
    kind: 'bracket',
    seats: answer.bracket.map((seat) => seatOf(seat, youId)),
    champion:
      answer.champion === null
        ? null
        : {
            displayName: answer.champion.displayName,
            isYou: youId !== null && answer.champion.userId === youId,
          },
  }
}

/**
 * THE COMPETITION'S VERDICT ON THIS PLAYER — WHERE ONE WAS STATED.
 *
 * Contract 193 carries `you_qualified`, which is a fact about the DRAW and not
 * about survival. It is honest to say "you qualified"; it would not be honest
 * to read its absence as elimination, because a player who has not qualified
 * may still be playing the group phase.
 *
 * So `champion` is stated where the server names one, `qualified` where the
 * server says so, and everything else is `not-stated`. No season read supplies
 * `eliminated` at all.
 */
function standingOf(source: ChampionshipSource, panel: BracketPanel): ChampionshipStanding {
  if (source.bracket.kind !== 'ok') return { kind: 'not-stated' }
  const answer = source.bracket.bracket
  if (!answer.entered) return { kind: 'not-stated' }

  if (panel.kind === 'bracket' && panel.champion?.isYou === true) {
    return { kind: 'stated', outcome: 'champion' }
  }
  if (answer.qualification.youQualified) return { kind: 'stated', outcome: 'qualified' }
  return { kind: 'not-stated' }
}

/**
 * CONTRACT 193'S PENALTY NUMBER STATE → THE PANEL.
 *
 * `locked` AND `open` ARE READ AS TWO INDEPENDENT BOOLEANS, because that is
 * what they are. Contract 193 computes them from `cup_window_first_kickoff`:
 *
 *     'locked', first_kickoff.at is not null and now() >= first_kickoff.at
 *     'open',   first_kickoff.at is not null and now() <  first_kickoff.at
 *
 * so an UNSCHEDULED round returns BOTH false. Treating one as the negation of
 * the other would call that round open and offer a control the write refuses
 * with `55000`. Both server-evaluated, against the database's own clock —
 * nothing here compares an instant.
 *
 * A SUBMITTED VALUE OF ZERO IS A SUBMISSION. `0` is a legal Penalty Number in
 * the even lane, so the case is chosen on `value !== null` rather than on
 * truthiness.
 */
function penaltyNumberOf(source: ChampionshipSource): PenaltyNumberPanel {
  if (source.bracket.kind !== 'ok') return { kind: 'not-required' }
  const answer = source.bracket.bracket
  if (!answer.entered) return { kind: 'not-required' }

  const pn = answer.penaltyNumber
  if (pn === null) return { kind: 'not-required' }

  if (pn.locked) return { kind: 'locked', value: pn.value }
  // NEITHER LOCKED NOR OPEN: the round has no scheduled kickoff. Its own case.
  if (!pn.open) return { kind: 'unscheduled' }

  return pn.value === null
    ? { kind: 'open', lane: pn.lane, locksAt: pn.locksAt }
    : { kind: 'submitted', lane: pn.lane, value: pn.value, locksAt: pn.locksAt }
}

/**
 * CONTRACT 167'S GROUP STAGE → THE PANEL.
 *
 * CARRIED, NOT COMPUTED. `rank` is the standings authority's and is printed as
 * sent; nothing here orders rows, totals points or breaks a tie. Contract 167's
 * own header states that rule, and a surface that re-sorted would be the second
 * authority on a table that already has one.
 *
 * `isYou` and `isYours` are the SERVER'S flags, not a name or id compared here
 * — Stage 9's identity rule, and the same reason the bracket takes its side
 * from `my_ties[].is_home`.
 *
 * THREE PAYLOAD STATES, THREE PANELS. `available: false` means this
 * competition has no group stage at all; `entered: false` means it has one the
 * caller is not in; an empty `groups` means drawn-but-not-yet-populated. None
 * of them is a failure, and none is inferred from another.
 */
function groupPanelOf(source: ChampionshipSource): GroupPanel {
  if (source.groupStage.kind !== 'ok') return { kind: 'unavailable' }

  const answer = source.groupStage.groupStage
  if (!answer.available) return { kind: 'no-groups' }
  if (!answer.entered) return { kind: 'not-entered' }
  if (answer.groups.length === 0) return { kind: 'no-groups' }

  return {
    kind: 'groups',
    yourOrdinal: answer.myGroupOrdinal,
    groups: answer.groups.map((group) => ({
      groupId: group.groupId,
      ordinal: group.ordinal,
      isYours: group.isMyGroup,
      rows: group.rows.map((row) => ({
        rank: row.rank,
        userId: row.userId,
        displayName: row.displayName,
        isYou: row.isMe,
        tablePoints: row.tablePoints,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        exacts: row.exacts,
        corrects: row.corrects,
        scorelineError: row.scorelineError,
      })),
    })),
  }
}

export function buildChampionshipModel(source: ChampionshipSource): ChampionshipPageModel {
  const bracket = bracketPanelOf(source)
  return {
    generatedAt: source.generatedAt,
    context: {
      competitionName: source.context.competitionName,
      seasonLabel: source.context.seasonLabel,
      gameName: source.context.gameName,
    },
    standing: standingOf(source, bracket),
    bracket,
    groups: groupPanelOf(source),
    penaltyNumber: penaltyNumberOf(source),
  }
}
