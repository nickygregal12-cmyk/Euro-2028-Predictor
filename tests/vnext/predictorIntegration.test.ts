import { describe, expect, it } from 'vitest'
import type { MatchPredictorPage } from '../../src/features/season/matchPredictorModel'
import { presentCard } from '../../src/features/season/matchPredictorModel'
import type { SeasonClubFormTable } from '../../src/services/supabase/seasonClubFormModel'
import type { CompetitionTableRow } from '../../src/services/supabase/competitionTableModel'
import type { SeasonConsensus } from '../../src/services/supabase/seasonConsensusModel'
import { buildPredictorModel } from '../../src/vnext/integration/predictor/buildPredictorModel'
import type { PredictorSource } from '../../src/vnext/integration/predictor/predictorSource'
import { at } from '../support/indexed'

/**
 * WHAT THE MATCH PREDICTOR ADAPTER MUST NEVER DO.
 *
 * `buildPredictorModel` is pure, so this suite needs no Supabase, no auth, no
 * network and no mocking at all. Every case below is a sentence about TRUTH rather
 * than about shape — the type checker already has shape covered, and these are the
 * bugs that compile:
 *
 *   1. it never decides whether a prediction may be edited;
 *   2. it never compares a kickoff or a deadline to reach a permission;
 *   3. it never produces a points value, and above all never a per-fixture one;
 *   4. it never lets a consensus through that the server withheld;
 *   5. it never turns an unknown into a zero;
 *   6. it never lets one club's football land on the other club.
 */

const NOW = '2027-08-20T18:30:00.000Z'
const LOCK_AT = '2027-08-21T11:30:00.000Z'

/* ------------------------------------------------------------------ *
 * Builders. Small, explicit, overridable per case.
 * ------------------------------------------------------------------ */

function club(name: string, monogram: string, primary: string) {
  return { name, shortName: name, tokens: { monogram, primary } }
}

function card(overrides: Partial<MatchPredictorPage> = {}): MatchPredictorPage {
  return {
    competition: { name: 'Caledonian Premiership', seasonLabel: '2027/28', timeZone: 'Europe/London' },
    matchweek: { number: 4, of: 38 },
    fixtures: [
      {
        fixtureId: 'fx-1',
        kickoffAt: LOCK_AT,
        home: club('Glenmore Athletic', 'GLN', '#0B4DA2'),
        away: club('Strathkelvin United', 'STK', '#0F7A3D'),
        prediction: { home: 2, away: 1 },
        result: null,
        points: null,
      },
      {
        fixtureId: 'fx-2',
        kickoffAt: '2027-08-21T14:00:00.000Z',
        home: club('Carrickvale Rovers', 'CRV', '#8B1E3F'),
        away: club('Northmuir Rangers', 'NMR', '#1B4D3E'),
        prediction: null,
        result: null,
        points: null,
      },
    ],
    cardStatus: 'provisional',
    lock: { status: 'open', locked: false, lockAt: LOCK_AT, reason: 'before_scope_lock' },
    joker: { playedHere: false, remainingThisHalf: 4, playable: true },
    settledPoints: null,
    ...overrides,
  }
}

function source(overrides: Partial<PredictorSource> = {}): PredictorSource {
  const page = overrides.card ?? card()
  return {
    generatedAt: NOW,
    competition: { name: 'Caledonian Premiership', seasonLabel: '2027/28', matchweekCount: 38 },
    card: page,
    // THE APPLICATION'S OWN ANSWER, produced by the application's own function.
    // Hand-writing a `CardPresentation` here would let the adapter start disagreeing
    // with `presentCard` while every test still passed.
    presentation: presentCard(page, false),
    saveStatus: {},
    refusal: null,
    clubForm: null,
    table: null,
    consensus: null,
    ...overrides,
  }
}

function formTable(overrides: Partial<SeasonClubFormTable> = {}): SeasonClubFormTable {
  return {
    serverNow: NOW,
    matches: 6,
    clubs: [
      {
        teamId: 't-1',
        name: 'Glenmore Athletic',
        tokens: { monogram: 'GLN', primary: '#0B4DA2' },
        played: 5,
        won: 3,
        drawn: 1,
        lost: 1,
        goalsFor: 9,
        goalsAgainst: 3,
        form: ['W', 'W', 'D', 'L', 'W'],
      },
      {
        teamId: 't-2',
        name: 'Strathkelvin United',
        tokens: { monogram: 'STK', primary: '#0F7A3D' },
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        form: [],
      },
    ],
    ...overrides,
  }
}

function tableRow(name: string, position: number): CompetitionTableRow {
  return {
    position,
    teamId: `team-${name}`,
    teamName: name,
    played: 5,
    won: 3,
    drawn: 1,
    lost: 1,
    goalsFor: 9,
    goalsAgainst: 3,
    goalDifference: 6,
    points: 10,
    adjustment: null,
    boundary: null,
  }
}

function consensus(overrides: Partial<SeasonConsensus> = {}): SeasonConsensus {
  return {
    suppressed: false,
    matchweek: 4,
    minimumEntries: 10,
    submittedEntries: 2140,
    lockedAt: LOCK_AT,
    fixtures: [
      {
        id: 'fx-1',
        homeName: 'Glenmore Athletic',
        awayName: 'Strathkelvin United',
        kickoffAt: LOCK_AT,
        resultHome: null,
        resultAway: null,
        predicted: 100,
        homeWin: 71,
        draw: 18,
        awayWin: 11,
        shares: { homeWin: 71, draw: 18, awayWin: 11 },
        topScores: [
          { home: 2, away: 0, picks: 19 },
          { home: 3, away: 1, picks: 16 },
        ],
      },
    ],
    ...overrides,
  }
}

/* ------------------------------------------------------------------ *
 * 1 and 2 — permissions are consumed, never computed
 * ------------------------------------------------------------------ */

describe('editability and the lock', () => {
  it('carries the presentation’s editable flag through unchanged', () => {
    const open = buildPredictorModel(source())
    expect(open.editable).toBe(true)
    expect(open.fixtures.every((fixture) => fixture.editable)).toBe(true)
  })

  it('never infers a lock from a kickoff that has passed', () => {
    // A kickoff two years ago, and a server that says the scope is still open.
    // The mapper must believe the server. Anything else is the browser deciding a
    // deadline, which is the one thing this layer may not do.
    const page = card({
      fixtures: [{ ...at(card().fixtures, 0), kickoffAt: '2025-01-01T00:00:00.000Z' }],
      lock: { status: 'open', locked: false, lockAt: LOCK_AT, reason: 'before_scope_lock' },
    })
    const model = buildPredictorModel(source({ card: page }))

    expect(model.editable).toBe(true)
    expect(model.phase).toBe('open')
    expect(model.fixtures[0]?.editable).toBe(true)
  })

  it('never infers an open card from a deadline in the future', () => {
    const page = card({
      lock: { status: 'locked', locked: true, lockAt: '2099-01-01T00:00:00.000Z', reason: 'scope_lock_reached' },
    })
    const model = buildPredictorModel(source({ card: page }))

    expect(model.editable).toBe(false)
    expect(model.phase).toBe('locked')
    expect(model.fixtures.every((fixture) => fixture.editable)).toBe(false)
  })

  it('keeps an unresolvable lock as unavailable rather than as a deadline', () => {
    const page = card({
      lock: { status: 'locked', locked: true, lockAt: null, reason: 'missing_fixture_data' },
    })
    const model = buildPredictorModel(source({ card: page }))

    expect(model.lock.kind).toBe('unavailable')
    expect(model.phase).toBe('unavailable')
    // No deadline, so no countdown may be offered and no urgency may be claimed.
    expect(model.lock.at).toBeNull()
    expect(model.lock.urgency).toBeNull()
    expect(model.lock.retryable).toBe(true)
    expect(model.notice?.tone).toBe('warn')
  })

  it('takes the lock’s words from the application rather than writing its own', () => {
    const model = buildPredictorModel(source())
    expect(model.lock.label).toBe('Open')
    expect(model.lock.detail).toBe(
      'Your predictions for this matchweek are saved as you enter them.',
    )
  })

  it('claims no urgency once the matchweek is closed', () => {
    const page = card({
      lock: { status: 'locked', locked: true, lockAt: LOCK_AT, reason: 'scope_lock_reached' },
    })
    // A passed deadline has an outcome, not an urgency. Toning a locked card as
    // urgent would be shouting about something nobody can act on.
    expect(buildPredictorModel(source({ card: page })).lock.urgency).toBeNull()
  })

  it.each([
    ['calm', '2027-08-24T11:30:00.000Z'],
    ['soon', '2027-08-21T11:30:00.000Z'],
    ['urgent', '2027-08-20T19:30:00.000Z'],
  ] as const)('bands a %s deadline from two supplied instants', (expected, lockAt) => {
    const page = card({
      lock: { status: 'open', locked: false, lockAt, reason: 'before_scope_lock' },
    })
    expect(buildPredictorModel(source({ card: page })).lock.urgency).toBe(expected)
  })

  it('states what the lock will do as a fact rather than as a sentence', () => {
    // The words are the surface's; `atLock` is the application's two-valued answer,
    // and carrying a finished sentence would either duplicate the legacy page's
    // private copy or disagree with the counts beside it.
    expect(buildPredictorModel(source()).atLock).toBe('banksEntered')

    const untouched = card({ cardStatus: 'no_submission', fixtures: [
      { ...at(card().fixtures, 0), prediction: null },
      at(card().fixtures, 1),
    ] })
    expect(buildPredictorModel(source({ card: untouched })).atLock).toBe('unbanked')
  })

  it('reports a conflict as terminal and offers a reload', () => {
    const page = card()
    const model = buildPredictorModel(
      source({
        card: page,
        presentation: presentCard(page, true),
        saveStatus: { 'fx-1': 'conflict' },
      }),
    )

    expect(model.phase).toBe('conflict')
    expect(model.editable).toBe(false)
    expect(model.notice?.tone).toBe('error')
    expect(model.notice?.retryable).toBe(true)
    expect(model.fixtures[0]?.save).toBe('conflict')
  })
})

/* ------------------------------------------------------------------ *
 * 3 — no points value is ever produced here
 * ------------------------------------------------------------------ */

describe('points and verdicts', () => {
  it('carries the server’s per-fixture figure and never the rule’s own', () => {
    // The card supplies `points: null` on the real path, and `explainFixtureScore`
    // returns a number this mapper deliberately ignores. An exact score is worth
    // more than zero under the rule, and it still must not be printed here.
    const page = card({
      fixtures: [{ ...at(card().fixtures, 0), result: { home: 2, away: 1 }, points: null }],
      settledPoints: 12,
    })
    const model = buildPredictorModel(source({ card: page }))

    expect(model.fixtures[0]?.verdict).toBe('exact')
    expect(model.fixtures[0]?.points).toBeNull()
    expect(model.settledPoints).toBe(12)
  })

  it('passes a per-fixture figure through where the application does supply one', () => {
    const page = card({
      fixtures: [{ ...at(card().fixtures, 0), result: { home: 2, away: 1 }, points: 5 }],
      settledPoints: 5,
    })
    expect(buildPredictorModel(source({ card: page })).fixtures[0]?.points).toBe(5)
  })

  it('takes the verdict from the shared rule for all four of its answers', () => {
    const base = at(card().fixtures, 0)
    const cases = [
      { prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 }, verdict: 'exact' },
      { prediction: { home: 3, away: 1 }, result: { home: 2, away: 1 }, verdict: 'result' },
      { prediction: { home: 0, away: 2 }, result: { home: 2, away: 1 }, verdict: 'missed' },
      // `unscored`: the rule neither awarded nor withheld anything, so there is no
      // verdict. Calling this "missed" would tell a player they predicted badly
      // when they did not predict.
      { prediction: null, result: { home: 2, away: 1 }, verdict: null },
    ] as const

    for (const entry of cases) {
      const page = card({
        fixtures: [{ ...base, prediction: entry.prediction, result: entry.result }],
        settledPoints: 10,
      })
      expect(buildPredictorModel(source({ card: page })).fixtures[0]?.verdict).toBe(entry.verdict)
    }
  })

  it('states no verdict before a fixture has an official result', () => {
    const model = buildPredictorModel(source())
    expect(model.fixtures.every((fixture) => fixture.verdict === null)).toBe(true)
    expect(model.settledPoints).toBeNull()
    expect(model.tally).toBeNull()
  })

  it('counts the settled split and keeps a blank apart from a miss', () => {
    const base = at(card().fixtures, 0)
    const page = card({
      fixtures: [
        { ...base, fixtureId: 'a', prediction: { home: 2, away: 1 }, result: { home: 2, away: 1 } },
        { ...base, fixtureId: 'b', prediction: { home: 3, away: 1 }, result: { home: 2, away: 1 } },
        { ...base, fixtureId: 'c', prediction: { home: 0, away: 3 }, result: { home: 2, away: 1 } },
        { ...base, fixtureId: 'd', prediction: null, result: { home: 2, away: 1 } },
        // Not settled, so it is in no bucket at all.
        { ...base, fixtureId: 'e', prediction: { home: 1, away: 1 }, result: null },
      ],
      settledPoints: 14,
    })

    expect(buildPredictorModel(source({ card: page })).tally).toEqual({
      exact: 1,
      result: 1,
      missed: 1,
      blank: 1,
    })
  })

  it('itemises nothing for a matchweek the player never entered', () => {
    // Unbanked is not "every fixture scored zero". Itemising misses against
    // predictions that were never made is a breakdown of a thing that did not
    // happen — the same line `presentMatchweekPoints` draws.
    const base = at(card().fixtures, 0)
    const page = card({
      cardStatus: 'no_submission',
      fixtures: [{ ...base, prediction: null, result: { home: 2, away: 1 } }],
      settledPoints: 0,
    })
    const model = buildPredictorModel(source({ card: page }))

    expect(model.tally).toBeNull()
    expect(model.settledPoints).toBe(0)
  })

  it('marks a fixture with an official result as settled and not editable', () => {
    // An official result means the platform has settled the fixture, whatever the
    // card-level flag says. The AND can only ever narrow the application's answer.
    const page = card({
      fixtures: [
        { ...at(card().fixtures, 0), result: { home: 1, away: 1 } },
        at(card().fixtures, 1),
      ],
    })
    const model = buildPredictorModel(source({ card: page }))

    expect(model.editable).toBe(true)
    expect(model.fixtures[0]?.state).toBe('settled')
    expect(model.fixtures[0]?.editable).toBe(false)
    expect(model.fixtures[1]?.editable).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * 4 — consensus is the server's to give
 * ------------------------------------------------------------------ */

describe('community consensus', () => {
  it('shows none when the read did not answer', () => {
    const model = buildPredictorModel(source({ consensus: null }))
    expect(model.fixtures.every((fixture) => fixture.consensus === null)).toBe(true)
    expect(model.enrichment.consensus).toBe(false)
  })

  it('shows none when the server suppressed it', () => {
    // Contract 130's third way of saying no: too few entries to reveal anybody.
    // A suppressed payload still carries fixtures, and letting them through would
    // be the browser overruling a reveal rule.
    const model = buildPredictorModel(
      source({ consensus: consensus({ suppressed: true }) }),
    )
    expect(model.fixtures.every((fixture) => fixture.consensus === null)).toBe(true)
    expect(model.enrichment.consensus).toBe(false)
  })

  it('maps the server’s counts onto the fixture that owns them, and no other', () => {
    const model = buildPredictorModel(source({ consensus: consensus() }))

    expect(model.fixtures[0]?.consensus).not.toBeNull()
    // The payload named only `fx-1`. `fx-2` must not inherit its crowd.
    expect(model.fixtures[1]?.consensus).toBeNull()
    expect(model.enrichment.consensus).toBe(true)
  })

  it('converts the server’s percentages to shares without re-deriving them', () => {
    const group = at(buildPredictorModel(source({ consensus: consensus() })).fixtures, 0).consensus
    expect(group?.homeWinShare).toBeCloseTo(0.71)
    expect(group?.drawShare).toBeCloseTo(0.18)
    expect(group?.awayWinShare).toBeCloseTo(0.11)
    expect(group?.sampleSize).toBe(100)
    expect(group?.popular[0]).toEqual({ score: { home: 2, away: 0 }, share: 0.19 })
  })

  it('produces one cohort and never invents a friends group from it', () => {
    // Contract 130's cohort is the competition's entrants. A second group over the
    // same sample would be two labels for one set of numbers.
    const group = at(buildPredictorModel(source({ consensus: consensus() })).fixtures, 0).consensus
    expect(group?.label).toBe('Everyone')
  })
})

/* ------------------------------------------------------------------ *
 * 5 and 6 — unknown is null, and football lands on the right club
 * ------------------------------------------------------------------ */

describe('enrichment', () => {
  it('reports which reads answered, so absence and emptiness stay apart', () => {
    const none = buildPredictorModel(source())
    expect(none.enrichment).toEqual({ form: false, table: false, consensus: false })

    const all = buildPredictorModel(
      source({
        clubForm: formTable(),
        table: [tableRow('Glenmore Athletic', 2)],
        consensus: consensus(),
      }),
    )
    expect(all.enrichment).toEqual({ form: true, table: true, consensus: true })
  })

  it('gives a club with nothing settled an empty run and no record sentence', () => {
    // Not "0 form" and not a padded run of five: at matchweek one that is every
    // club in the competition, and an empty row of pills reads as a terrible season.
    const model = buildPredictorModel(source({ clubForm: formTable() }))
    expect(model.fixtures[0]?.away.form).toEqual([])
    expect(model.fixtures[0]?.away.formRecord).toBeNull()
    // And the read DID answer, which the surface says differently.
    expect(model.enrichment.form).toBe(true)
  })

  it('maps the server’s letters one for one and never re-reads who won', () => {
    const model = buildPredictorModel(source({ clubForm: formTable() }))
    expect(model.fixtures[0]?.home.form).toEqual(['win', 'win', 'draw', 'loss', 'win'])
    expect(model.fixtures[0]?.home.formRecord).toEqual({
      record: 'Won 3, drawn 1, lost 1 of the last 5',
      goalDifference: '+6',
      played: 5,
    })
  })

  it('never lands one club’s form on the other club', () => {
    const model = buildPredictorModel(source({ clubForm: formTable() }))
    expect(model.fixtures[0]?.home.team.name).toBe('Glenmore Athletic')
    expect(model.fixtures[0]?.home.form.length).toBe(5)
    expect(model.fixtures[0]?.away.team.name).toBe('Strathkelvin United')
    expect(model.fixtures[0]?.away.form.length).toBe(0)
    // A club the form table does not mention gets nothing rather than a neighbour's.
    expect(model.fixtures[1]?.home.form).toEqual([])
    expect(model.fixtures[1]?.away.form).toEqual([])
  })

  it('leaves a league position null rather than zero when the table has no row', () => {
    const model = buildPredictorModel(
      source({ table: [tableRow('Glenmore Athletic', 2)] }),
    )
    expect(model.fixtures[0]?.home.leaguePosition).toBe(2)
    expect(model.fixtures[0]?.away.leaguePosition).toBeNull()
    expect(model.fixtures[1]?.home.leaguePosition).toBeNull()
  })

  it('reports a competition with no palette as having none', () => {
    // No application source holds one, and the shell falls back to a plain canvas.
    expect(buildPredictorModel(source()).competition.colours).toBeNull()
  })

  it('turns an empty kickoff string back into a real absence', () => {
    // The gateway maps an absent kickoff to `''`; a surface formatting that would
    // print a formatted nothing.
    const page = card({ fixtures: [{ ...at(card().fixtures, 0), kickoffAt: '' }] })
    expect(buildPredictorModel(source({ card: page })).fixtures[0]?.kickoff).toBeNull()
  })

  it('resolves club identity from the domain tokens and no crest', () => {
    const model = buildPredictorModel(source())
    const home = at(model.fixtures, 0).home.team
    expect(home.abbreviation).toBe('GLN')
    expect(home.colours.primary).toBe('#0B4DA2')
    // A club with only one colour gets its primary in both roles rather than a
    // computed brighter shade, and no crest source is agreed anywhere.
    expect(home.colours.accent).toBe('#0B4DA2')
    expect(home.officialBadge).toBeNull()
  })
})

/* ------------------------------------------------------------------ *
 * The Joker and the confirm command
 * ------------------------------------------------------------------ */

describe('commands', () => {
  it('asks the application why a Joker would be refused rather than deciding', () => {
    const permitted = buildPredictorModel(source())
    expect(permitted.joker.playable).toBe(true)
    expect(permitted.joker.refusal).toBeNull()

    const spent = card({ joker: { playedHere: false, remainingThisHalf: 0, playable: false } })
    const refused = buildPredictorModel(source({ card: spent }))
    expect(refused.joker.playable).toBe(false)
    expect(refused.joker.refusal).toBe('You have no Jokers left for this half of the season.')
  })

  it('refuses the Joker on a locked card in the application’s own words', () => {
    const page = card({
      lock: { status: 'locked', locked: true, lockAt: LOCK_AT, reason: 'scope_lock_reached' },
    })
    expect(buildPredictorModel(source({ card: page })).joker.refusal).toBe(
      'This matchweek is locked.',
    )
  })

  it('offers confirm only where the command would be accepted', () => {
    expect(buildPredictorModel(source()).confirm).toEqual({ state: 'available', refusal: null })

    const confirmed = card({ cardStatus: 'confirmed' })
    expect(buildPredictorModel(source({ card: confirmed })).confirm.state).toBe('confirmed')

    const nothingEntered = card({
      cardStatus: 'provisional',
      fixtures: card().fixtures.map((fixture) => ({ ...fixture, prediction: null })),
    })
    const refused = buildPredictorModel(source({ card: nothingEntered })).confirm
    expect(refused.state).toBe('refused')
    expect(refused.refusal).toBe('Enter at least one prediction before confirming the card.')

    const locked = card({
      lock: { status: 'locked', locked: true, lockAt: LOCK_AT, reason: 'scope_lock_reached' },
    })
    expect(buildPredictorModel(source({ card: locked })).confirm.state).toBe('absent')
  })

  it('surfaces a refused command as a quiet notice in the application’s words', () => {
    const model = buildPredictorModel(source({ refusal: 'This matchweek is locked.' }))
    expect(model.notice).toEqual({
      tone: 'warn',
      title: 'That is not possible right now',
      body: 'This matchweek is locked.',
      retryable: false,
    })
  })

  it('carries the save status per fixture and defaults the rest to idle', () => {
    const model = buildPredictorModel(source({ saveStatus: { 'fx-1': 'saving' } }))
    expect(model.fixtures[0]?.save).toBe('saving')
    expect(model.fixtures[1]?.save).toBe('idle')
  })

  it('ignores a save-status key that is not a fixture', () => {
    // The hook also keys `joker` and `card`. Neither is a fixture and neither may
    // leak onto one.
    const model = buildPredictorModel(source({ saveStatus: { joker: 'error', card: 'saved' } }))
    expect(model.fixtures.every((fixture) => fixture.save === 'idle')).toBe(true)
  })
})

/* ------------------------------------------------------------------ *
 * Progress and the matchweek label
 * ------------------------------------------------------------------ */

describe('the matchweek', () => {
  it('takes the entered count from the application rather than counting again', () => {
    const model = buildPredictorModel(source())
    expect(model.progress).toEqual({ entered: 1, total: 2 })
  })

  it('states the matchweek and its bound from the card read', () => {
    const model = buildPredictorModel(source())
    expect(model.matchweek).toEqual({ number: 4, of: 38, label: 'Matchweek 4' })
  })

  it('is deterministic: the same source builds the same model', () => {
    // Nothing in the mapper reads a clock, so two builds of one source cannot
    // differ. A `Date.now()` anywhere beneath it would fail here.
    const input = source({ clubForm: formTable(), consensus: consensus() })
    expect(buildPredictorModel(input)).toEqual(buildPredictorModel(input))
  })
})
