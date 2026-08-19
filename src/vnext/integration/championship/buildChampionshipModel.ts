import type {
  BracketPanel,
  BracketSeat,
  BracketSide,
  ChampionshipPageModel,
  ChampionshipStanding,
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

  // DRAWN IS THE SERVER'S WORD, not "the array is non-empty". A competition can
  // be drawn with the caller's own view of it still filtering to nothing.
  if (!answer.qualification.drawn || answer.bracket.length === 0) {
    return { kind: 'not-drawn' }
  }

  // WHO "YOU" ARE, taken from a seat the server already marked as the caller's
  // rather than from any id this lane was passed. `is_yours` is contract 193's
  // own flag, so the identity never comes from a route or a query string —
  // Stage 9's rule, in the one place this page could have broken it.
  const yours = answer.bracket.find((seat) => seat.isYours) ?? null
  const youId =
    yours === null
      ? null
      : ((): string | null => {
          // The caller is whichever side of their own seat is not the opponent
          // named in `my_tie`; where there is no live tie, the seat alone
          // cannot say which side is theirs, and null is the honest answer.
          const opponentId = answer.myTie?.opponent?.userId ?? null
          if (opponentId === null) return null
          if (yours.home !== null && yours.home.userId !== opponentId) return yours.home.userId
          if (yours.away !== null && yours.away.userId !== opponentId) return yours.away.userId
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
  }
}
