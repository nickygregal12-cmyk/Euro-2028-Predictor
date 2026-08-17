/**
 * ONE DESIGNED MATCHWEEK, for reviewing the Match Predictor.
 *
 * TEN FIXTURES, BECAUSE TEN IS THE THING UNDER TEST. A card of five is
 * comfortable to work through because it is short; the brief's own requirement
 * is that ten are comfortable, so the review surface is ten. Twenty clubs play
 * once each — nobody appears twice, which is what a matchweek is.
 *
 * EVERY INSTANT IS FIXED AND NOTHING READS A CLOCK. The matchweek's fixtures run
 * from Saturday lunchtime to Sunday afternoon and the deadline is the first
 * kickoff, exactly as `mainPredictorLockPolicy` resolves it — zero buffer, the
 * earliest kickoff in the scope. The scenarios move `generatedAt` around that
 * fixed deadline rather than moving the football, which is what makes "19 hours
 * away" and "85 minutes away" the same card in two states rather than two cards.
 *
 * THE FOOTBALL HERE IS PRESENTATION INPUT AND NOT A GAME RULE. Form runs, league
 * positions and crowd splits are designed to exercise the surface: a promoted
 * side with three results rather than five, a club with nothing settled at all, a
 * fixture where the crowd is 71% one way, and one where the player has gone
 * against it. None of them is a claim about football and none is a rule.
 */

import type { FormResult } from '../../models/football'
import type { PredictorSide } from '../../models/predictor'
import { workshopTeams } from '../teams/teams'
import { predictorClubs } from './clubs'

/** The deadline this matchweek locks at: its own earliest kickoff. */
export const MATCHWEEK_LOCK_AT = '2027-08-21T11:30:00.000Z'

/** Friday evening. The card is open and the weekend has not started. */
export const PREDICTOR_NOW = '2027-08-20T18:30:00.000Z'

/** Saturday morning, eighty-five minutes out. The same card, shouting. */
export const PREDICTOR_NOW_URGENT = '2027-08-21T10:05:00.000Z'

/** The Monday after. Every result is in and the matchweek has been scored. */
export const PREDICTOR_NOW_SETTLED = '2027-08-23T09:00:00.000Z'

type SideSpec = {
  readonly team: PredictorSide['team']
  readonly form: readonly FormResult[]
  readonly position: number | null
  /** "Won 4, drawn 1, lost 1 of the last 6" and its goal difference. */
  readonly record: readonly [string, string] | null
}

function side(spec: SideSpec): PredictorSide {
  return {
    team: spec.team,
    form: spec.form,
    formRecord:
      spec.record === null
        ? null
        : {
            record: spec.record[0],
            goalDifference: spec.record[1],
            played: spec.form.length,
          },
    leaguePosition: spec.position,
  }
}

/** A side with every optional enrichment stripped, for the reduced scenario. */
export function bareSide(from: PredictorSide): PredictorSide {
  return { team: from.team, form: [], formRecord: null, leaguePosition: null }
}

const W: FormResult = 'win'
const D: FormResult = 'draw'
const L: FormResult = 'loss'

/**
 * The ten fixtures, in kickoff order, which is the order a card is worked
 * through. Each entry carries only the football — the player's prediction, the
 * result, the lock state and the crowd are the scenarios' business, because those
 * are what differ between them.
 */
export const matchweekFootball: readonly {
  readonly id: string
  readonly kickoff: string | null
  readonly home: PredictorSide
  readonly away: PredictorSide
}[] = [
  {
    id: 'fixture-glenmore-auchentoshan',
    kickoff: MATCHWEEK_LOCK_AT,
    home: side({
      team: workshopTeams.glenmore,
      form: [W, W, D, L, W],
      position: 2,
      record: ['Won 3, drawn 1, lost 1 of the last 5', '+6'],
    }),
    away: side({
      team: predictorClubs.auchentoshan,
      form: [L, D, L, W, L],
      position: 11,
      record: ['Won 1, drawn 1, lost 3 of the last 5', '−4'],
    }),
  },
  {
    id: 'fixture-strathkelvin-strathallan',
    kickoff: MATCHWEEK_LOCK_AT,
    home: side({
      team: workshopTeams.strathkelvin,
      form: [W, W, W, D, W],
      position: 1,
      record: ['Won 4, drawn 1, lost 0 of the last 5', '+11'],
    }),
    away: side({
      team: predictorClubs.strathallan,
      form: [D, L, D, L, D],
      position: 15,
      record: ['Won 0, drawn 3, lost 2 of the last 5', '−5'],
    }),
  },
  {
    id: 'fixture-carrickvale-northmuir',
    kickoff: '2027-08-21T14:00:00.000Z',
    home: side({
      team: workshopTeams.carrickvale,
      form: [L, W, D, W, W],
      position: 4,
      record: ['Won 3, drawn 1, lost 1 of the last 5', '+3'],
    }),
    away: side({
      team: predictorClubs.northmuir,
      form: [W, D, W, W, D],
      position: 3,
      record: ['Won 3, drawn 2, lost 0 of the last 5', '+7'],
    }),
  },
  {
    id: 'fixture-balmorral-lochranza',
    kickoff: '2027-08-21T14:00:00.000Z',
    home: side({
      team: workshopTeams.balmorral,
      form: [D, D, L, D, W],
      position: 8,
      record: ['Won 1, drawn 3, lost 1 of the last 5', '0'],
    }),
    away: side({
      // A promoted side, three matches in. The run is genuinely three pills long
      // rather than padded to five with blanks that never happened.
      team: predictorClubs.lochranza,
      form: [L, L, D],
      position: 19,
      record: ['Won 0, drawn 1, lost 2 of the last 3', '−6'],
    }),
  },
  {
    id: 'fixture-invercaledonian-braemarnock',
    kickoff: '2027-08-21T16:30:00.000Z',
    home: side({
      team: workshopTeams.invercaledonian,
      form: [W, L, W, L, W],
      position: 6,
      record: ['Won 3, drawn 0, lost 2 of the last 5', '+1'],
    }),
    away: side({
      team: predictorClubs.braemarnock,
      form: [L, W, L, D, L],
      position: 13,
      record: ['Won 1, drawn 1, lost 3 of the last 5', '−3'],
    }),
  },
  {
    id: 'fixture-porthaven-fintryhill',
    kickoff: '2027-08-22T12:00:00.000Z',
    home: side({
      team: workshopTeams.porthaven,
      form: [W, D, W, W, L],
      position: 5,
      record: ['Won 3, drawn 1, lost 1 of the last 5', '+4'],
    }),
    away: side({
      team: predictorClubs.fintryhill,
      form: [D, W, D, W, W],
      position: 7,
      record: ['Won 3, drawn 2, lost 0 of the last 5', '+5'],
    }),
  },
  {
    id: 'fixture-eastcraig-garnockside',
    kickoff: '2027-08-22T12:00:00.000Z',
    home: side({
      team: workshopTeams.eastcraig,
      form: [L, D, W, L, D],
      position: 12,
      record: ['Won 1, drawn 2, lost 2 of the last 5', '−2'],
    }),
    away: side({
      team: predictorClubs.garnockside,
      form: [W, W, L, D, W],
      position: 9,
      record: ['Won 3, drawn 1, lost 1 of the last 5', '+2'],
    }),
  },
  {
    id: 'fixture-dunveggie-tarbethmoor',
    kickoff: '2027-08-22T14:15:00.000Z',
    home: side({
      // A club with nothing settled behind it, which is what every club looks
      // like at matchweek one. The panel says so in words rather than drawing an
      // empty run of five, which would read as a terrible season.
      team: workshopTeams.dunveggie,
      form: [],
      position: 16,
      record: null,
    }),
    away: side({
      team: predictorClubs.tarbethmoor,
      form: [D, L, L, W, L],
      position: 17,
      record: ['Won 1, drawn 1, lost 3 of the last 5', '−7'],
    }),
  },
  {
    id: 'fixture-kirktonmuir-kilbraneth',
    kickoff: '2027-08-22T14:15:00.000Z',
    home: side({
      team: workshopTeams.kirktonmuir,
      form: [W, W, W, W, D],
      position: 10,
      record: ['Won 4, drawn 1, lost 0 of the last 5', '+8'],
    }),
    away: side({
      team: predictorClubs.kilbraneth,
      form: [L, L, D, L, W],
      position: 14,
      record: ['Won 1, drawn 1, lost 3 of the last 5', '−6'],
    }),
  },
  {
    id: 'fixture-arbrennan-ardrishmuir',
    /**
     * A REAL KICKOFF, AND THE ABSENT ONE IS DELIBERATELY NOT HERE.
     *
     * The row does handle `kickoff: null` — it says so rather than formatting a
     * nothing — but a matchweek containing one CANNOT be open, and putting one in
     * this list would have made every open scenario a lie. `resolveLockState`
     * returns `invalid_fixture_data` the moment any fixture in the scope has no
     * kickoff it can parse, which fails the whole matchweek closed. So the absent
     * kickoff belongs to the `unavailable` scenario, where it is also the CAUSE of
     * that scenario rather than a decoration on it.
     */
    kickoff: '2027-08-22T16:30:00.000Z',
    home: side({
      team: workshopTeams.arbrennan,
      form: [D, W, L, D, W],
      position: 18,
      record: ['Won 2, drawn 2, lost 1 of the last 5', '−1'],
    }),
    away: side({
      team: predictorClubs.ardrishmuir,
      form: [W, L, W, D, L],
      position: 20,
      record: ['Won 2, drawn 1, lost 2 of the last 5', '−2'],
    }),
  },
]
