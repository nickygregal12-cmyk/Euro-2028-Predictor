import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CUP_GROUP_CAP,
  CUP_MINIMUM_FIELD,
  CUP_MINIMUM_MEETINGS,
  selectCupFormat,
} from '../../src/domain/season/cupFormat'
import { PUBLIC_CUP_ENTRANT_THRESHOLD, resolvePublicCupLaunch } from '../../src/domain/season/cupLaunch'
import { CUP_TIE_MATCH_POINTS, settleCupTie } from '../../src/domain/season/cupTieSettlement'

/**
 * The season Predictor Championship's pure rules, in both languages.
 *
 * `predictor_internal.cup_*` already existed before this. The parity here is
 * against the NEW functions only, and nothing asserts the tournament machinery.
 *
 * CORRECTION. This block originally said the season "ranks by an eight-step
 * tie-break" against the tournament's §6.3 normalisation — "two rule sets for
 * two competitions". Comparing the actual comparator against the actual
 * `order by` showed the group-table rankings are IDENTICAL, nine keys in the
 * same sequence; see `cupGroupTableParity.test.ts`, which now pins them
 * together. The §6.3 wildcard normalisation is real but lives in the
 * QUALIFICATION path, not the ordering, so the guard below still correctly
 * excludes it from the season bodies.
 *
 * The rule most worth protecting is the neutral-points contract: a Cup tie
 * settles on RAW fixture points, 0/3/5. A Joker-doubled value must be refused,
 * because accepting 6 or 10 lets a player carry their league Joker into a
 * knockout tie and win it on points the Championship never awarded.
 */

const migrationsDirectory = resolve(process.cwd(), 'supabase/migrations')
const allSql = readdirSync(migrationsDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .map((file) => readFileSync(resolve(migrationsDirectory, file), 'utf8'))
  .join('\n')

/**
 * The LAST definition, not the first.
 *
 * `allSql` is every migration concatenated in order, so a non-greedy `exec`
 * returns whichever definition was written FIRST — which stops being the
 * installed one the moment any later contract redefines the function. Contract
 * 198 redefined `select_season_cup_format`, and this suite went on asserting
 * against contract 94's superseded text until it was pointed at the end.
 *
 * That is the same defect contract 194 hit in a migration: reading committed
 * text is only sound if it is the LATEST committed text.
 */
function lastDefinition(name: string): string {
  // Anchored on `create or replace function`, not on the bare name: a mere
  // CALL to the function inside some other body would otherwise match and
  // capture the CALLER's body instead. That happened while writing this.
  const pattern = new RegExp(
    `create or replace function [\\w.]*${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`,
    'gi',
  )
  let body = ''
  for (const match of allSql.matchAll(pattern)) body = match[1] ?? body
  return body
}

const format = lastDefinition('select_season_cup_format')

const tie = lastDefinition('settle_season_cup_tie')
const launch = lastDefinition('resolve_public_cup_launch')

/**
 * Contract 96 EXTRACTED the four per-entrant checks.
 *
 * This suite used to read the first definition of every function, and for
 * `settle_season_cup_tie` that meant contract 94's body — which still had the
 * raw-scale, unconfirmed-fixture and missing-points checks written inline.
 * Contract 96 moved them into `cup_tie_entrant_total`, because it had found by
 * differential sweep that two inline copies interleaved by fixture reported the
 * wrong entrant's fault; the extraction is the fix, not an accident of style.
 *
 * So those assertions were not wrong about the rules, and they are not wrong
 * now — they were pointed at a body that had stopped containing them. They move
 * to the helper, and the settler is separately required to CALL it, so proving
 * something about the helper still proves something about what settles a tie.
 */
const tieEntrant = lastDefinition('cup_tie_entrant_total')

const card = [
  { fixtureId: 'f1', confirmedByCutoff: true },
  { fixtureId: 'f2', confirmedByCutoff: true },
]

describe('the SQL counterparts exist', () => {
  it('finds all four bodies', () => {
    expect(tie, 'settle_season_cup_tie body not found').not.toBe('')
    expect(tieEntrant, 'cup_tie_entrant_total body not found').not.toBe('')
    expect(format, 'select_season_cup_format body not found').not.toBe('')
    expect(launch, 'resolve_public_cup_launch body not found').not.toBe('')
  })

  it('reads the INSTALLED definition, not a superseded one', () => {
    // The assertion about the assertions. `settle_season_cup_tie` is defined
    // twice — contract 94 wrote it inline, contract 96 rewrote it around the
    // helper — and a first-match read returns contract 94's, which is not what
    // any database holds. If this ever fails, every `tie` assertion below has
    // quietly stopped describing the installed function.
    expect(tie).toContain('cup_tie_entrant_total')
    expect(tie, 'the inline per-entrant checks belong to the helper now').not.toContain(
      'points_off_raw_scale',
    )
  })

  it('settles home completely before away, which is what contract 96 fixed', () => {
    // The defect was an interleaved walk: home and away checked within each
    // fixture iteration, so a tie wrong at a later fixture for home and an
    // earlier one for away reported away's fault. Two sequential calls are the
    // fix, and their ORDER is the rule — the first must be p_home.
    const homeCall = tie.indexOf('cup_tie_entrant_total(p_home')
    const awayCall = tie.indexOf('cup_tie_entrant_total(p_away')
    expect(homeCall, 'the home total is not computed by the shared helper').toBeGreaterThan(-1)
    expect(awayCall, 'the away total is not computed by the shared helper').toBeGreaterThan(-1)
    expect(homeCall, 'away is evaluated before home, so a doubly-wrong tie reports the wrong fault').toBeLessThan(awayCall)
  })
})

describe('a Cup tie settles on raw points only', () => {
  it('refuses a Joker-doubled value in TypeScript', () => {
    // 6 is 3 doubled, 10 is 5 doubled. Either would be a league Joker reaching
    // a competition that does not award one.
    expect(
      settleCupTie(
        card,
        { entryId: 'home', fixturePoints: { f1: 6, f2: 3 } },
        { entryId: 'away', fixturePoints: { f1: 3, f2: 3 } },
      ),
    ).toEqual({ ok: false, reason: 'points_off_raw_scale' })
  })

  it('permits exactly the raw scale in SQL', () => {
    expect(tieEntrant).toMatch(/not in \(0, 3, 5\)/)
    expect(tieEntrant).toContain('points_off_raw_scale')
    // The doubled values must not appear as accepted members of the scale.
    expect(tieEntrant).not.toMatch(/in \(0, 3, 5, 6\b/)
    expect(tieEntrant).not.toMatch(/in \(0, 3, 5, 10\b/)
  })

  it('agrees on the match points awarded', () => {
    expect(CUP_TIE_MATCH_POINTS).toEqual({ win: 3, draw: 1, loss: 0 })
    expect(tie).toMatch(/v_home_match := 3; v_away_match := 0/)
    expect(tie).toMatch(/v_home_match := 0; v_away_match := 3/)
    expect(tie).toMatch(/v_home_match := 1; v_away_match := 1/)
  })
})

describe('a tie reports what it was settled on', () => {
  it('settles on the confirmed subset and says so', () => {
    const settled = settleCupTie(
      [{ fixtureId: 'f1', confirmedByCutoff: true }, { fixtureId: 'f2', confirmedByCutoff: false }],
      { entryId: 'home', fixturePoints: { f1: 5 } },
      { entryId: 'away', fixturePoints: { f1: 3 } },
    )
    expect(settled).toMatchObject({
      ok: true,
      settlement: { settledOnFixtures: 1, fixtureCardSize: 2, reducedSet: true },
    })
    expect(settled.ok && settled.settlement.home.points).toBe(5)
  })

  it('refuses points offered for an unconfirmed fixture rather than ignoring them', () => {
    // A caller sending them disagrees about which fixtures decided the tie.
    // Dropping them silently would settle it on a card neither side agreed to.
    expect(
      settleCupTie(
        [{ fixtureId: 'f1', confirmedByCutoff: true }, { fixtureId: 'f2', confirmedByCutoff: false }],
        { entryId: 'home', fixturePoints: { f1: 5, f2: 5 } },
        { entryId: 'away', fixturePoints: { f1: 3 } },
      ),
    ).toEqual({ ok: false, reason: 'points_for_unconfirmed_fixture' })
    expect(tieEntrant).toContain('points_for_unconfirmed_fixture')
  })

  it('refuses a confirmed fixture with no points', () => {
    expect(
      settleCupTie(
        card,
        { entryId: 'home', fixturePoints: { f1: 5 } },
        { entryId: 'away', fixturePoints: { f1: 3, f2: 3 } },
      ),
    ).toEqual({ ok: false, reason: 'points_missing_for_confirmed_fixture' })
    expect(tieEntrant).toContain('points_missing_for_confirmed_fixture')
  })

  it('refuses a tie with nothing confirmed rather than calling it a draw', () => {
    // A goalless draw would award a match point each and settle a knockout
    // round on fixtures that never played.
    expect(
      settleCupTie(
        [{ fixtureId: 'f1', confirmedByCutoff: false }],
        { entryId: 'home', fixturePoints: {} },
        { entryId: 'away', fixturePoints: {} },
      ),
    ).toEqual({ ok: false, reason: 'no_settled_fixtures' })
    expect(tie).toContain('no_settled_fixtures')
    const noneConfirmed = tie.indexOf('no_settled_fixtures')
    const drawBranch = tie.indexOf("v_result := 'draw'")
    expect(
      noneConfirmed,
      'the draw branch precedes the no-settled-fixtures refusal, so an unplayed tie would be drawn',
    ).toBeLessThan(drawBranch)
  })

  it('reports the same three facts in SQL', () => {
    for (const fact of ['settledOnFixtures', 'fixtureCardSize', 'reducedSet']) {
      expect(tie).toContain(fact)
    }
    expect(tie).toMatch(/confirmedByCutoff/)
  })

  it.each([
    ['a duplicate fixture', 'duplicate_fixture'],
    ['the same entrant twice', 'same_entrant_twice'],
  ])('%s is refused in both', (_label, reason) => {
    expect(tie).toContain(reason)
  })
})

describe('format selection agrees on every threshold', () => {
  it('declines below the minimum field rather than running a Cup', () => {
    expect(CUP_MINIMUM_FIELD).toBe(4)
    expect(selectCupFormat(3, 40)).toEqual({ kind: 'declined_head_to_head' })
    expect(format).toMatch(new RegExp(`p_field_size < ${CUP_MINIMUM_FIELD}`))
    expect(format).toContain('declined_head_to_head')
  })

  it('uses the same group cap and minimum meetings', () => {
    expect(CUP_GROUP_CAP).toBe(20)
    expect(CUP_MINIMUM_MEETINGS).toBe(2)
    expect(format).toMatch(new RegExp(`p_field_size <= ${CUP_GROUP_CAP} and v_meetings >= ${CUP_MINIMUM_MEETINGS}`))
    expect(format).toMatch(new RegExp(`least\\(${CUP_GROUP_CAP},`))
  })

  it('refuses rather than shortening when no group fits two meetings', () => {
    expect(selectCupFormat(40, 3)).toEqual({ kind: 'refused', reason: 'insufficient_rounds' })
    expect(format).toContain('insufficient_rounds')
  })

  it('derives meetings by the same division', () => {
    // Integer division in both: floor(remaining / (field - 1)).
    expect(selectCupFormat(8, 14)).toMatchObject({ kind: 'single_group', meetings: 2 })
    expect(format).toMatch(/p_remaining_rounds \/ \(p_field_size - 1\)/)
  })

  it('returns the calendar tail, not just the shape', () => {
    // An exact fit has no tail; a short Cup reports the window it leaves.
    expect(selectCupFormat(8, 14)).toMatchObject({
      leagueRounds: 14,
      tail: { kind: 'none' },
      leftoverRounds: 0,
    })
    expect(selectCupFormat(6, 20)).toMatchObject({ meetings: 4, tail: { kind: 'none' } })
    // CONTRACT 198 changed this one. Six over twenty-four leaves four rounds
    // after a four-meeting league; four qualifiers need a two-round bracket, so
    // two are RESERVED and two are genuinely spare. Before contract 198 the
    // whole remainder was reported as a `seeded_playoff_window` whether or not
    // it could hold the bracket.
    expect(selectCupFormat(6, 24)).toMatchObject({
      meetings: 4,
      leagueRounds: 20,
      tail: { kind: 'none' },
      knockout: { rounds: 2, qualifiers: 4 },
      leftoverRounds: 2,
    })
    for (const key of ['leagueRounds', 'leftoverRounds', 'knockout']) {
      expect(format).toContain(key)
    }
    // The unconditional window is gone from both authorities.
    expect(format).not.toContain('seeded_playoff_window')
  })

  it('balances the odd meeting with a split, and steps down when it will not fit', () => {
    // Six over eighteen: three meetings (15 rounds) plus a 3-round split fits
    // exactly. Ten over thirty: three meetings (27) plus a 5-round split does
    // not, so it plays two meetings instead of shortening the split.
    expect(selectCupFormat(6, 18)).toMatchObject({
      meetings: 3,
      leagueRounds: 15,
      tail: { kind: 'split', topHalfSize: 3, bottomHalfSize: 3, splitRounds: 3 },
      leftoverRounds: 0,
    })
    // Ten over thirty steps down to two meetings, and contract 198 then
    // reserves three of the twelve remaining rounds for the seven qualifiers'
    // bracket rather than calling all twelve a playoff window.
    expect(selectCupFormat(10, 30)).toMatchObject({
      meetings: 2,
      tail: { kind: 'none' },
      knockout: { rounds: 3, qualifiers: 7 },
      leftoverRounds: 9,
    })
    expect(format).toMatch(/v_meetings % 2 = 1/)
    expect(format).toMatch(/v_meetings := v_meetings - 1/)
    for (const key of ['topHalfSize', 'bottomHalfSize', 'splitRounds']) {
      expect(format).toContain(key)
    }
  })

  it('draws balanced groups rather than filling the cap first', () => {
    // Thirty entrants is two groups of fifteen. Filling to the cap would give
    // a twenty and a ten, which is a different competition.
    expect(selectCupFormat(30, 38)).toEqual({
      kind: 'groups',
      groupCount: 2,
      groupSizes: [15, 15],
      // CONTRACT 198: a multi-group field cannot be one league, so it always
      // reserves. Twenty qualifiers need a five-round bracket.
      knockout: { rounds: 5, qualifiers: 20 },
    })
    expect(selectCupFormat(25, 38)).toMatchObject({
      groupSizes: [13, 12],
      knockout: { rounds: 5, qualifiers: 17 },
    })
    expect(format).toContain('groupSizes')
    expect(format).toMatch(/v_base := p_field_size \/ v_group_count/)
    expect(format).toMatch(/v_remainder := p_field_size % v_group_count/)
    // The cap must not be the group size it reports.
    expect(format).not.toMatch(/'largestGroup'/)
  })

  it('refuses when the smallest balanced group falls below the minimum field', () => {
    expect(selectCupFormat(7, 6)).toEqual({ kind: 'refused', reason: 'insufficient_rounds' })
    expect(format).toMatch(new RegExp(`v_base < ${CUP_MINIMUM_FIELD}`))
  })
})

describe('the public launch threshold', () => {
  it('opens at the threshold and not below', () => {
    expect(PUBLIC_CUP_ENTRANT_THRESHOLD).toBe(100)
    expect(resolvePublicCupLaunch({ entrants: 100, publicCupRunning: false })).toEqual({
      open: true,
      entrants: 100,
    })
    expect(resolvePublicCupLaunch({ entrants: 99, publicCupRunning: false })).toEqual({
      open: false,
      entrants: 99,
      shortfall: 1,
      reason: 'below_threshold',
    })
  })

  it('refuses while one is already running, however many have queued', () => {
    // One public Cup per competition season (ADR 0014).
    expect(resolvePublicCupLaunch({ entrants: 5000, publicCupRunning: true })).toMatchObject({
      open: false,
      reason: 'already_running',
    })
    expect(launch).toContain('already_running')
    const runningBranch = launch.indexOf('p_public_cup_running then')
    const thresholdBranch = launch.indexOf(`p_entrants >= ${PUBLIC_CUP_ENTRANT_THRESHOLD}`)
    expect(
      runningBranch,
      'the threshold is tested before the running check, so a queued crowd would open a second Cup',
    ).toBeLessThan(thresholdBranch)
  })

  it('returns a shortfall rather than a bare refusal', () => {
    // "23 more needed" is what the interface has to say.
    expect(launch).toContain('shortfall')
    expect(launch).toMatch(new RegExp(`${PUBLIC_CUP_ENTRANT_THRESHOLD} - p_entrants`))
  })
})

describe('the tournament Cup machinery is untouched', () => {
  it('adds no reference to the §6.3 wildcard ordering', () => {
    // The season Championship ranks by its own eight-step tie-break. Borrowing
    // the tournament ordering would import another competition's rules.
    for (const body of [tie, format, launch]) {
      expect(body).not.toMatch(/group_size - 1/)
    }
  })

  it('keeps every new function server-side and immutable', () => {
    for (const fn of ['settle_season_cup_tie', 'select_season_cup_format', 'resolve_public_cup_launch']) {
      expect(allSql).toMatch(new RegExp(`${fn}[\\s\\S]*?immutable`))
      expect(allSql).toMatch(
        new RegExp(`revoke all on function predictor_internal\\.${fn}[\\s\\S]*?from public, anon, authenticated`),
      )
    }
  })
})
