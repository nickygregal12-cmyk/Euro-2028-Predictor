import { describe, expect, it } from 'vitest'
import {
  buildMatchesModel,
  matchStateOf,
} from '../../src/vnext/integration/matches/buildMatchesModel'
import { buildMatchCentreModel } from '../../src/vnext/integration/matches/buildMatchCentreModel'
import type { MatchesSource } from '../../src/vnext/integration/matches/matchesSource'
import type { MatchCentreSource } from '../../src/vnext/integration/matches/matchCentreSource'
import { matchPhase, matchScoreClaim } from '../../src/vnext/models/matches'
import type { SeasonListFixture } from '../../src/services/supabase/seasonFixtureListModel'
import type { SeasonClubFormTable } from '../../src/services/supabase/seasonClubFormModel'
import type { CompetitionTable } from '../../src/services/supabase/competitionTableModel'
import { at, first } from '../support/indexed'

/**
 * THE STAGE 8 MAPPING, TESTED AS TRUTH RATHER THAN AS SHAPE.
 *
 * Every case is a call to a pure mapper with a hand-built source. There is no
 * Supabase, no network, no auth, no React and NO CLOCK — which is the point:
 * the mapping is the only place a real fixture becomes something a page draws,
 * and it was written as a pure function so this file could exist.
 *
 * WHAT THE ASSERTIONS ARE ABOUT. Almost none of them check that a field was
 * copied; a rename would be caught by the compiler. They check the things that
 * would be WRONG rather than merely different:
 *
 *   1. A LIVE MINUTE IS NEVER INFERRED FROM A CLOCK — the single defect this
 *      whole stage is arranged to prevent, and the reason `NOW` below is hours
 *      after some kickoffs and before others.
 *   2. A provider's score never becomes a settled result.
 *   3. A provider may not postpone, abandon or cancel a fixture.
 *   4. Extra time, penalties, aggregates, timelines, statistics, lineups,
 *      venue, broadcast and the referee are ALL null, because no read supplies
 *      any of them — the honesty §17–§19 require, held as a test so a future
 *      "temporary" fabrication fails.
 *   5. A stage label is the server's word and is never built from an ordinal.
 *   6. Impossible states do not typecheck, and the ones that could be smuggled
 *      through data do not survive the mapper.
 */

/**
 * DELIBERATELY LATE. Several fixtures below kicked off HOURS before this
 * instant with no live block at all. A mapper that read a clock would call them
 * live, or finished, or in the 187th minute. Every one of them must map to
 * `scheduled`.
 */
const NOW = '2027-08-21T18:00:00.000Z'

function club(name: string, monogram: string) {
  return { name, tokens: { monogram, primary: '#123456' } }
}

function fixture(overrides: Partial<SeasonListFixture> = {}): SeasonListFixture {
  return {
    id: 'fx-1',
    kickoffAt: '2027-08-21T14:00:00.000Z',
    status: 'scheduled',
    round: { id: 'r-4', ordinal: 4, label: 'Matchweek 4' },
    home: club('Porthaven City', 'POR'),
    away: club('Glenmore Athletic', 'GLN'),
    result: null,
    live: null,
    ...overrides,
  }
}

function source(overrides: Partial<MatchesSource> = {}): MatchesSource {
  return {
    generatedAt: NOW,
    competition: {
      tournamentId: 'tournament-1',
      name: 'Caledonian Premiership',
      seasonLabel: '2027/28',
      colours: null,
    },
    window: { from: '2027-08-14T00:00:00.000Z', to: '2027-09-04T00:00:00.000Z' },
    serverNow: NOW,
    fixtures: [fixture()],
    competitionRead: {
      id: 'tournament-1',
      name: 'Caledonian Premiership',
      seasonKey: '2027-28',
      timeZone: 'Europe/London',
      slug: 'caledonian-premiership',
    },
    playerCompetitionCount: null,
    combined: null,
    ...overrides,
  }
}

/* ======================================================================== *
 * THE LIVE-DATA RULE
 * ======================================================================== */

describe('the live-data rule', () => {
  it('never infers a live state from a kickoff that has passed', () => {
    // Four hours before `NOW`, and the server says scheduled with no provider
    // block. A mapper comparing instants would call this live or finished.
    const state = matchStateOf(fixture({ kickoffAt: '2027-08-21T14:00:00.000Z' }))

    expect(state.kind).toBe('scheduled')
    expect(matchScoreClaim(state)).toBeNull()
  })

  it('never produces a minute, because contract 135 carries none', () => {
    const state = matchStateOf(
      fixture({
        live: { kind: 'in_play', home: 2, away: 1, observedAt: '2027-08-21T15:51:00.000Z' },
      }),
    )

    expect(state.kind).toBe('live')
    if (state.kind !== 'live') throw new Error('unreachable')
    // THE ASSERTION THIS WHOLE STAGE TURNS ON. The platform can prove the match
    // is in play. It cannot prove what minute it is, and nothing here invents
    // one from the fact that kickoff was 111 minutes ago.
    expect(state.observation.clock).toBeNull()
    expect(state.observation.phaseLabel).toBe('Live')
  })

  it('formats the observation instant itself, so no component picks a zone', () => {
    const state = matchStateOf(
      fixture({
        live: { kind: 'in_play', home: 1, away: 0, observedAt: '2027-08-21T15:41:00.000Z' },
      }),
    )

    if (state.kind !== 'live') throw new Error('unreachable')
    // A component formatting this itself has to choose a zone, and the one it
    // chose was hard-coded — so a viewer outside that zone saw a kickoff on one
    // clock and an observation on another. Labels are the mapper's.
    expect(state.observation.observedAtLabel).not.toBeNull()
    expect(state.observation.observedAtLabel).toMatch(/^\d{2}:\d{2}$/)
  })

  it('carries the provider’s own observation instant, and never a mount time', () => {
    const state = matchStateOf(
      fixture({
        live: { kind: 'in_play', home: 0, away: 0, observedAt: '2027-08-21T15:41:00.000Z' },
      }),
    )

    if (state.kind !== 'live') throw new Error('unreachable')
    expect(state.observation.observedAt).toBe('2027-08-21T15:41:00.000Z')
    // The freshness a surface may report is the SERVER's, so it is checkable
    // and does not move when a component re-renders.
    expect(state.observation.observedAt).not.toBe(NOW)
  })

  it('reports live with no score at all when the provider has sent none', () => {
    // "In play, no goals reported yet" is real information and is not 0–0.
    const state = matchStateOf(
      fixture({
        live: { kind: 'in_play', home: null, away: null, observedAt: NOW },
      }),
    )

    if (state.kind !== 'live') throw new Error('unreachable')
    expect(state.observation.score).toBeNull()
    expect(matchScoreClaim(state)).toBeNull()
  })

  it('refuses a half-sided provider score rather than drawing one number', () => {
    const state = matchStateOf(
      fixture({ live: { kind: 'in_play', home: 2, away: null, observedAt: NOW } }),
    )

    if (state.kind !== 'live') throw new Error('unreachable')
    expect(state.observation.score).toBeNull()
  })
})

/* ======================================================================== *
 * PROVIDER VERSUS PLATFORM
 * ======================================================================== */

describe('provider truth and platform truth', () => {
  it('calls a settled result official and a provider score provisional', () => {
    const settled = matchStateOf(fixture({ status: 'played', result: { home: 2, away: 1 } }))
    const reported = matchStateOf(
      fixture({ live: { kind: 'in_play', home: 2, away: 1, observedAt: NOW } }),
    )

    expect(matchScoreClaim(settled)?.basis).toBe('official')
    expect(matchScoreClaim(reported)?.basis).toBe('provisional')
    // The two are the same numbers and DIFFERENT CLAIMS, which is the whole
    // reason the read keeps `result` and `live` in separate fields.
    expect(matchScoreClaim(settled)?.score).toEqual(matchScoreClaim(reported)?.score)
  })

  it('does not promote a provider’s "final" to a settled result', () => {
    const state = matchStateOf(
      fixture({
        status: 'scheduled',
        result: null,
        live: { kind: 'final', home: 2, away: 1, observedAt: NOW },
      }),
    )

    // `awaitingResult`, not `finished`. The football is over and the platform
    // has not confirmed a result; collapsing the two would be a browser turning
    // a feed into a settlement.
    expect(state.kind).toBe('awaitingResult')
    expect(matchScoreClaim(state)?.basis).toBe('provisional')
    // It still groups with the finished football, because that is what a reader
    // scanning "what just finished" means.
    expect(matchPhase(state)).toBe('finished')
  })

  it.each(['postponed', 'abandoned', 'cancelled'] as const)(
    'does not let a provider’s "%s" move the platform’s own state',
    (kind) => {
      const state = matchStateOf(
        fixture({ status: 'scheduled', live: { kind, home: null, away: null, observedAt: NOW } }),
      )

      // A feed reports these for ordinary reasons — a delayed kickoff, an
      // outage, a mis-mapped fixture — and letting one through would empty a
      // fixture list on a provider's say-so.
      expect(state.kind).toBe('scheduled')
    },
  )

  it.each([
    ['postponed', 'postponed'],
    ['abandoned', 'abandoned'],
    ['void', 'void'],
  ] as const)('takes the platform’s own "%s" and drops any provider score', (status, kind) => {
    const state = matchStateOf(
      fixture({
        status,
        live: { kind: 'in_play', home: 1, away: 0, observedAt: NOW },
      }),
    )

    expect(state.kind).toBe(kind)
    // A postponed fixture that a feed once reported in play must not keep the
    // numbers — that is how a postponed match ends up drawn with a live score.
    expect(matchScoreClaim(state)).toBeNull()
  })

  it('does not let a provider refine a fixture the platform already called played', () => {
    // The schema makes a played fixture with no result impossible, so this is a
    // payload contradicting its own constraint. It must not become `live` on a
    // feed's say-so and must not carry a provisional score for a match the
    // PLATFORM has already ruled on.
    const state = matchStateOf(
      fixture({
        status: 'played',
        result: null,
        live: { kind: 'in_play', home: 1, away: 0, observedAt: NOW },
      }),
    )

    expect(state.kind).toBe('scheduled')
    expect(matchScoreClaim(state)).toBeNull()
  })

  it('treats an unknown provider token as no information at all', () => {
    const state = matchStateOf(
      fixture({ live: { kind: 'unknown', home: 3, away: 3, observedAt: NOW } }),
    )

    expect(state.kind).toBe('scheduled')
  })
})

/* ======================================================================== *
 * WHAT NO READ SUPPLIES
 * ======================================================================== */

describe('what the platform cannot supply', () => {
  it('never produces extra time, penalties or an aggregate', () => {
    const state = matchStateOf(fixture({ status: 'played', result: { home: 3, away: 1 } }))

    if (state.kind !== 'finished') throw new Error('unreachable')
    // `season_fixtures` holds one score pair and a status. There is no
    // extra-time column, no shootout and no aggregate anywhere, so a knockout
    // drawn with either would be presentation inventing a competition rule.
    expect(state.decision).toBeNull()
    expect(state.aggregate).toBeNull()
  })

  it('never produces a prediction badge on a list row', () => {
    const model = buildMatchesModel(source())

    // §14: the only read that carries predictions answers ONE matchweek, and a
    // badge on some rows of a multi-matchweek window reads as "nothing needed"
    // on the rest.
    expect(first(first(model.days).matches).prediction).toBeNull()
  })

  it('leaves every tier-3 module null on a Match Centre', () => {
    const model = buildMatchCentreModel(centreSource())

    // Not empty arrays and not zeroes: ABSENT. §17–§19, held as a test so a
    // future "temporary" fabrication fails rather than shipping.
    expect(model.timeline).toBeNull()
    expect(model.statistics).toBeNull()
    expect(model.lineups).toBeNull()
    expect(model.venue).toBeNull()
    expect(model.broadcast).toBeNull()
    expect(model.referee).toBeNull()
  })

  it('leaves the stage kind null, because no fixture read projects it', () => {
    const model = buildMatchesModel(source())

    // `competition_rounds.kind` genuinely holds league_matchweek /
    // group_matchday / knockout_round. Neither contract 139 nor 148 sends it,
    // and inferring it from the label would be presentation deciding what shape
    // a competition is.
    expect(first(first(model.days).matches).stage.kind).toBeNull()
  })
})

/* ======================================================================== *
 * STAGE LABELS AND GROUPING
 * ======================================================================== */

describe('stages and days', () => {
  it.each([
    'Matchweek 7',
    'Quarter-finals',
    'Group A · Matchday 2',
    'Semi-final, second leg',
  ])('prints the competition’s own word for a stage: %s', (label) => {
    const model = buildMatchesModel(
      source({ fixtures: [fixture({ round: { id: 'r', ordinal: 4, label } })] }),
    )

    const item = first(first(model.days).matches)
    expect(item.stage.label).toBe(label)
    // Nothing anywhere turned ordinal 4 into "Matchweek 4".
    expect(item.contextLabel).toBe(label)
  })

  it('groups by the day a match is played and labels it by its own stage', () => {
    // The owner's 5 August amendment: a fixture postponed out of matchweek 2
    // keeps its round on purpose, so grouping by round would file it under a
    // September heading. It belongs beside the matches it is played beside.
    const model = buildMatchesModel(
      source({
        fixtures: [
          fixture({ id: 'a', round: { id: 'r-4', ordinal: 4, label: 'Matchweek 4' } }),
          fixture({
            id: 'b',
            round: { id: 'r-2', ordinal: 2, label: 'Matchweek 2' },
            kickoffAt: '2027-08-21T18:45:00.000Z',
          }),
        ],
      }),
    )

    expect(model.days).toHaveLength(1)
    const day = first(model.days)
    expect(day.matches).toHaveLength(2)
    expect(day.mixedStages).toBe(true)
    expect(at(day.matches, 1).stage.label).toBe('Matchweek 2')
  })

  it('keeps an untimed fixture and puts it last under its own heading', () => {
    const model = buildMatchesModel(
      source({
        fixtures: [fixture({ id: 'a' }), fixture({ id: 'b', kickoffAt: null })],
      }),
    )

    // A rearranged match the league has not timed yet is still a fixture, and
    // an unscheduled match is not the next thing to happen.
    expect(model.days).toHaveLength(2)
    expect(at(model.days, 1).key).toBe('undated')
    expect(at(model.days, 1).label).toBe('Date to be confirmed')
    expect(first(at(model.days, 1).matches).kickoffLabel).toBeNull()
  })

  it('preserves the server’s order rather than re-sorting it', () => {
    const model = buildMatchesModel(
      source({
        fixtures: [
          fixture({ id: 'later', kickoffAt: '2027-08-21T18:45:00.000Z' }),
          fixture({ id: 'earlier', kickoffAt: '2027-08-21T11:30:00.000Z' }),
        ],
      }),
    )

    // Re-sorting here would be a second opinion about when a match is played.
    expect(first(first(model.days).matches).id).toBe('later')
  })
})

/* ======================================================================== *
 * THE ACCESSIBLE SENTENCE
 * ======================================================================== */

describe('the accessible summary', () => {
  it('reads a score the way a person says it', () => {
    const model = buildMatchesModel(
      source({ fixtures: [fixture({ status: 'played', result: { home: 2, away: 1 } })] }),
    )

    // §31's requirement, and its counter-example is "2 1 Porthaven Glenmore".
    expect(first(first(model.days).matches).accessibleSummary).toBe(
      'Porthaven City 2, Glenmore Athletic 1, full time, Matchweek 4',
    )
  })

  it('says "provisional" in words, so colour is never the only signal', () => {
    const model = buildMatchesModel(
      source({
        fixtures: [
          fixture({ live: { kind: 'in_play', home: 1, away: 0, observedAt: NOW } }),
        ],
      }),
    )

    expect(first(first(model.days).matches).accessibleSummary).toBe(
      'Porthaven City 1, Glenmore Athletic 0, live, provisional score, Matchweek 4',
    )
  })

  it('carries the competition and the stage into the sentence a row announces', () => {
    const model = buildMatchesModel(
      source({
        playerCompetitionCount: 2,
        combined: {
          competitions: [
            { id: 'c-2', name: 'Northern Isles Champions Trophy', seasonLabel: '2027/28' },
          ],
          fixtures: [{ ...fixture({ id: 'a' }), competitionId: 'c-2' }],
        },
      }),
    )

    // EVERYTHING VISIBLE ON A ROW IS `aria-hidden`, so this sentence IS the
    // row's accessible name. Without the competition in it, four combined rows
    // spanning three competitions announced identically.
    const announced = first(first(model.days).matches).accessibleSummary
    expect(announced).toContain('Porthaven City against Glenmore Athletic')
    // ASSERTED AS A SUFFIX RATHER THAN A WHOLE STRING, because the kickoff
    // label resolves in the reader's own zone and this assertion is about the
    // context clause, not about which zone the test happens to run in.
    expect(announced).toContain('Northern Isles Champions Trophy · Matchweek 4')
    expect(announced.endsWith('Northern Isles Champions Trophy · Matchweek 4')).toBe(true)
  })

  it('names the stage in the sentence even in competition scope', () => {
    const model = buildMatchesModel(source())

    expect(first(first(model.days).matches).accessibleSummary).toContain('Matchweek 4')
  })

  it('names a postponement rather than describing a kick-off that will not happen', () => {
    const model = buildMatchesModel(source({ fixtures: [fixture({ status: 'postponed' })] }))

    expect(first(first(model.days).matches).accessibleSummary).toBe(
      'Porthaven City against Glenmore Athletic, postponed, Matchweek 4',
    )
  })
})

/* ======================================================================== *
 * SCOPE
 * ======================================================================== */

describe('the combined scope', () => {
  it('offers no scope control to a one-competition player', () => {
    const model = buildMatchesModel(source({ playerCompetitionCount: 1 }))

    // THE BINDING PRODUCT TEST. A control offering one choice teaches a player
    // there is a decision and then proves there is not.
    expect(model.scope.combinedAvailable).toBe(false)
    expect(model.scope.active).toBe('competition')
  })

  it('offers nothing where the host knows the count but cannot answer a calendar', () => {
    // BOTH CONDITIONS, NOT EITHER. This was an `||`, so a host that knew the
    // player had three competitions got a rendered "Across your 3 competitions"
    // button whose intent nothing could act on — and every connected path sets
    // `combined: null`, so that was every host that supplied a count.
    const model = buildMatchesModel(source({ playerCompetitionCount: 3, combined: null }))

    expect(model.scope.combinedAvailable).toBe(false)
  })

  it('drops a combined fixture it cannot attribute, rather than naming the wrong competition', () => {
    const model = buildMatchesModel(
      source({
        playerCompetitionCount: 2,
        competition: {
          tournamentId: 'c-1',
          name: 'Caledonian Premiership',
          seasonLabel: '2027/28',
          colours: { primary: '#0B2B5B', accent: '#4FA3FF' },
        },
        combined: {
          competitions: [{ id: 'c-1', name: 'Caledonian Premiership', seasonLabel: '2027/28' }],
          fixtures: [
            { ...fixture({ id: 'known' }), competitionId: 'c-1' },
            { ...fixture({ id: 'stranger' }), competitionId: 'c-9-not-in-list' },
          ],
        },
      }),
    )

    // THE WORST AVAILABLE FALLBACK WAS THE ACTIVE COMPETITION. The row would
    // not have failed to name a competition — it would confidently have named
    // the WRONG one, in that competition's colours, and every "names its
    // competition" check would still have passed.
    const ids = model.days.flatMap((day) => day.matches).map((match) => match.id)
    expect(ids).toEqual(['known'])
    // And the drop is REPORTED. A silent one reads as "we covered everything".
    expect(model.unavailable).toEqual([
      '1 match from a competition this page could not name',
    ])
  })

  it('offers no scope control where the host cannot say how many there are', () => {
    // `null` is "this host cannot answer", and it is treated exactly as one. A
    // control offered on a guess promises a mode the application may not enter.
    expect(buildMatchesModel(source({ playerCompetitionCount: null })).scope.combinedAvailable)
      .toBe(false)
  })

  it('offers it once the player is in more than one competition AND a calendar exists', () => {
    const model = buildMatchesModel(
      source({
        playerCompetitionCount: 3,
        combined: {
          competitions: [{ id: 'c-1', name: 'Caledonian Premiership', seasonLabel: '2027/28' }],
          fixtures: [{ ...fixture({ id: 'a' }), competitionId: 'c-1' }],
        },
      }),
    )

    expect(model.scope.combinedAvailable).toBe(true)
  })

  it('names the competition on every fixture in combined scope', () => {
    const model = buildMatchesModel(
      source({
        playerCompetitionCount: 2,
        combined: {
          competitions: [
            { id: 'c-1', name: 'Caledonian Premiership', seasonLabel: '2027/28' },
            { id: 'c-2', name: 'Northern Isles Champions Trophy', seasonLabel: '2027/28' },
          ],
          fixtures: [
            { ...fixture({ id: 'a' }), competitionId: 'c-1' },
            { ...fixture({ id: 'b' }), competitionId: 'c-2' },
          ],
        },
      }),
    )

    expect(model.scope.active).toBe('combined')
    // THE CONDITION THE MODE EXISTS UNDER. The moment a reader cannot tell
    // which competition a match is in, the combined view has erased the
    // architecture it is a layer over.
    for (const match of model.days.flatMap((day) => day.matches)) {
      expect(match.contextLabel).toContain(match.competition.name)
    }
    expect(first(first(model.days).matches).competition.name).toBe('Caledonian Premiership')
    expect(at(first(model.days).matches, 1).competition.name).toBe(
      'Northern Isles Champions Trophy',
    )
  })

  it('does not paint another competition in the active competition’s colours', () => {
    const model = buildMatchesModel(
      source({
        competition: {
          tournamentId: 'c-1',
          name: 'Caledonian Premiership',
          seasonLabel: '2027/28',
          colours: { primary: '#0B2B5B', accent: '#4FA3FF' },
        },
        combined: {
          competitions: [{ id: 'c-2', name: 'Caledonian Cup', seasonLabel: '2027/28' }],
          fixtures: [{ ...fixture({ id: 'a' }), competitionId: 'c-2' }],
        },
      }),
    )

    // No read holds a competition palette, and borrowing the active one would
    // paint every competition as the same competition.
    expect(first(first(model.days).matches).competition.colours).toBeNull()
  })
})

/* ======================================================================== *
 * COUNTS AND FILTERS
 * ======================================================================== */

describe('counts', () => {
  it('counts each phase from the state and never from a clock', () => {
    const model = buildMatchesModel(
      source({
        fixtures: [
          fixture({ id: 'a' }),
          fixture({ id: 'b', live: { kind: 'in_play', home: 0, away: 0, observedAt: NOW } }),
          fixture({ id: 'c', status: 'played', result: { home: 1, away: 1 } }),
          fixture({ id: 'd', status: 'postponed' }),
        ],
      }),
    )

    // A postponed fixture counts as upcoming, because that is where a reader
    // looking for what is coming will find it.
    expect(model.counts).toEqual({ all: 4, live: 1, upcoming: 2, finished: 1 })
  })
})

/* ======================================================================== *
 * THE MATCH CENTRE
 * ======================================================================== */

function formTable(overrides: Partial<SeasonClubFormTable> = {}): SeasonClubFormTable {
  return {
    serverNow: NOW,
    matches: 5,
    clubs: [
      {
        teamId: 'team-por',
        name: 'Porthaven City',
        tokens: { monogram: 'POR', primary: '#123456' },
        played: 4,
        won: 2,
        drawn: 1,
        lost: 1,
        goalsFor: 6,
        goalsAgainst: 4,
        form: ['W', 'D', 'L', 'W'],
      },
      {
        teamId: 'team-gln',
        name: 'Glenmore Athletic',
        tokens: { monogram: 'GLN', primary: '#654321' },
        played: 4,
        won: 3,
        drawn: 0,
        lost: 1,
        goalsFor: 9,
        goalsAgainst: 3,
        form: ['W', 'W', 'W', 'L'],
      },
    ],
    ...overrides,
  }
}

function tableRow(position: number, teamId: string, teamName: string) {
  return {
    position,
    teamId,
    teamName,
    played: 4,
    won: 2,
    drawn: 1,
    lost: 1,
    goalsFor: 6,
    goalsAgainst: 4,
    goalDifference: 2,
    points: 7,
    adjustment: null,
    boundary: null,
  }
}

function table(overrides: Partial<CompetitionTable> = {}): CompetitionTable {
  return {
    season: {
      id: 'tournament-1',
      name: 'Caledonian Premiership',
      seasonKey: '2027-28',
      status: 'active',
      displayTimeZone: 'Europe/London',
    },
    rules: {
      configured: true,
      pointsWin: 3,
      pointsDraw: 1,
      pointsLoss: 0,
      tieBreakers: ['goal_difference'],
      promotionPlaces: 0,
      playoffPlaces: 0,
      relegationPlaces: 0,
    },
    rows: [
      tableRow(1, 'team-gln', 'Glenmore Athletic'),
      tableRow(2, 'team-a', 'Arbrennan Saints'),
      tableRow(3, 'team-por', 'Porthaven City'),
      tableRow(4, 'team-b', 'Balmorral Thistle'),
      tableRow(5, 'team-c', 'Carrickvale Rovers'),
    ],
    provenance: {
      fixturesCounted: 20,
      fixturesOutstanding: 360,
      fixturesExcluded: 0,
      fixturesAwarded: 0,
      lastResultAt: NOW,
      providerConfirmed: 20,
      administratorConfirmed: 0,
      providers: ['sportmonks'],
    },
    ...overrides,
  }
}

function centreSource(overrides: Partial<MatchCentreSource> = {}): MatchCentreSource {
  return {
    generatedAt: NOW,
    fixture: fixture(),
    competition: {
      id: 'tournament-1',
      name: 'Caledonian Premiership',
      seasonKey: '2027-28',
      timeZone: 'Europe/London',
      slug: 'caledonian-premiership',
    },
    seasonLabel: '2027/28',
    colours: null,
    serverNow: NOW,
    // THE HOST LOADED NONE OF THE THREE SOCIAL SCOPES, which is what a mapper
    // test wants: it is measuring the fixture, the table and the head-to-head,
    // and a `null` module draws nothing rather than an empty one.
    you: null,
    leagues: null,
    everyone: null,
    clubForm: null,
    table: null,
    headToHead: null,
    predictorReachable: false,
    ...overrides,
  }
}

describe('the Match Centre mapping', () => {
  it('carries the canonical fixture id through unchanged', () => {
    const model = buildMatchCentreModel(centreSource({ fixture: fixture({ id: 'fx-canonical' }) }))

    // §29: a Match Centre is addressed by the fixture id and by nothing else.
    // Not by clubs and a date, and not by a position in a list.
    expect(model.id).toBe('fx-canonical')
  })

  it('describes a fixture identically whether it came from a list or a link', () => {
    const one = fixture({ status: 'played', result: { home: 2, away: 1 } })
    const fromList = first(first(buildMatchesModel(source({ fixtures: [one] })).days).matches)
    const fromLink = buildMatchCentreModel(centreSource({ fixture: one }))

    // The whole reason contract 148 returns contract 139's entry field for
    // field, and the reason both mappers share ONE state machine.
    expect(fromLink.state).toEqual(fromList.state)
    expect(fromLink.accessibleSummary).toBe(fromList.accessibleSummary)
    expect(fromLink.stage.label).toBe(fromList.stage.label)
  })

  it('renders no table for a competition that has none', () => {
    // Contract 160 refuses anything that is not a league season by raising, so
    // a cup tie's read lands as null — and §21 says do not draw one.
    expect(buildMatchCentreModel(centreSource({ table: null })).table).toBeNull()
  })

  it('takes the server’s position rather than the array index', () => {
    const model = buildMatchCentreModel(
      centreSource({ clubForm: formTable(), table: table() }),
    )

    // The home club is Porthaven, which the server puts third. Renumbering from
    // the array would look identical today and disagree the first time a stored
    // tie-break order changed.
    expect(model.home.tablePosition).toBe(3)
    expect(model.away.tablePosition).toBe(1)
  })

  it('marks both clubs in the table window and neither of the others', () => {
    const model = buildMatchCentreModel(
      centreSource({ clubForm: formTable(), table: table() }),
    )

    const marked = (model.table?.rows ?? []).filter((row) => row.isInThisMatch)
    expect(marked.map((row) => row.teamName)).toEqual([
      'Glenmore Athletic',
      'Porthaven City',
    ])
  })

  it('says a table is still being played when results are outstanding', () => {
    const model = buildMatchCentreModel(
      centreSource({ clubForm: formTable(), table: table() }),
    )

    // A table of a season with matches outstanding is a real table of an
    // incomplete season. Saying so is what stops it reading as final.
    expect(model.table?.provisional).toBe(true)
    expect(model.table?.provenanceLabel).toBe('20 counted · 360 still to play')
  })

  it('takes the server’s form letters rather than re-deriving them', () => {
    const model = buildMatchCentreModel(centreSource({ clubForm: formTable() }))

    expect(model.home.form).toEqual(['win', 'draw', 'loss', 'win'])
    expect(model.away.form).toEqual(['win', 'win', 'win', 'loss'])
  })

  it('keeps an empty head-to-head, because "they have not met" is an answer', () => {
    const model = buildMatchCentreModel(
      centreSource({
        headToHead: {
          team: { teamId: 'team-por', name: 'Porthaven City' },
          opponent: { teamId: 'team-gln', name: 'Glenmore Athletic' },
          summary: { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 },
          meetings: [],
        },
      }),
    )

    // Distinct from `null`, which is a read that did not respond.
    expect(model.headToHead).not.toBeNull()
    expect(model.headToHead?.meetings).toEqual([])
  })

  it('reports missing form when only ONE side is missing', () => {
    const oneSided: SeasonClubFormTable = {
      ...formTable(),
      // The away club is absent from the form answer — a rename, a reference
      // join difference, or a club outside the read's window.
      clubs: formTable().clubs.slice(0, 1),
    }
    const model = buildMatchCentreModel(centreSource({ clubForm: oneSided }))

    // The module would otherwise render one real run beside "No settled matches
    // yet" and say nothing — a reader concluding the club has not played when
    // the truth is that we could not read it.
    expect(model.unavailable).toContain('recent form')
  })

  it('renders no table window when neither club can be found in the table', () => {
    // No form read, so no team ids, so no way to locate either club. The old
    // fallback drew the top of the table under a caption reading "table around
    // {home} and {away}" — screen-reader-only text asserting a relationship
    // that is not there.
    const model = buildMatchCentreModel(centreSource({ clubForm: null, table: table() }))

    expect(model.table).toBeNull()
    expect(model.unavailable).toContain('the table')
  })

  it('names what it could not read, and never apologises for what the platform lacks', () => {
    const model = buildMatchCentreModel(centreSource())

    expect(model.unavailable).toEqual(['recent form', 'the table', 'previous meetings'])
    // Tier 3 is absent from the platform rather than unavailable just now, and
    // listing it on every match would be an apology for a product decision.
    expect(model.unavailable.join(' ')).not.toContain('lineup')
    expect(model.unavailable.join(' ')).not.toContain('timeline')
  })

  it('offers no Match Predictor link where the host cannot act on one', () => {
    const model = buildMatchCentreModel(centreSource({ predictorReachable: false }))

    // A control that exists and refuses teaches a player the product is broken.
    expect(model.links.map((link) => link.kind)).not.toContain('match-predictor')
  })

  it('offers one where the host can', () => {
    const model = buildMatchCentreModel(centreSource({ predictorReachable: true }))

    expect(model.links.map((link) => link.kind)).toContain('match-predictor')
    // §43: contextual navigation and never the page's purpose — one link, no
    // command, no payload, no score entry.
    expect(model.links.filter((link) => link.kind === 'match-predictor')).toHaveLength(1)
  })

  it('never produces a prediction on the Match Centre either', () => {
    // The whole matchweek card would be needed, and this page does not read it.
    expect(buildMatchCentreModel(centreSource()).prediction).toBeNull()
  })
})
