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
 * `predictor_internal.cup_*` already existed before this, but it implements the
 * TOURNAMENT Cup — §6.3 wildcard normalisation across differently sized groups.
 * The season Championship ranks by an eight-step tie-break. Two rule sets for
 * two competitions, so the parity here is against the new functions only, and
 * nothing asserts the tournament machinery.
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

const tie = /settle_season_cup_tie\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''
const format = /select_season_cup_format\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''
const launch = /resolve_public_cup_launch\([\s\S]*?\$\$([\s\S]*?)\$\$;/.exec(allSql)?.[1] ?? ''

const card = [
  { fixtureId: 'f1', confirmedByCutoff: true },
  { fixtureId: 'f2', confirmedByCutoff: true },
]

describe('the SQL counterparts exist', () => {
  it('finds all three bodies', () => {
    expect(tie, 'settle_season_cup_tie body not found').not.toBe('')
    expect(format, 'select_season_cup_format body not found').not.toBe('')
    expect(launch, 'resolve_public_cup_launch body not found').not.toBe('')
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
    expect(tie).toMatch(/not in \(0, 3, 5\)/)
    expect(tie).toContain('points_off_raw_scale')
    // The doubled values must not appear as accepted members of the scale.
    expect(tie).not.toMatch(/in \(0, 3, 5, 6\b/)
    expect(tie).not.toMatch(/in \(0, 3, 5, 10\b/)
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
    expect(tie).toContain('points_for_unconfirmed_fixture')
  })

  it('refuses a confirmed fixture with no points', () => {
    expect(
      settleCupTie(
        card,
        { entryId: 'home', fixturePoints: { f1: 5 } },
        { entryId: 'away', fixturePoints: { f1: 3, f2: 3 } },
      ),
    ).toEqual({ ok: false, reason: 'points_missing_for_confirmed_fixture' })
    expect(tie).toContain('points_missing_for_confirmed_fixture')
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
    expect(selectCupFormat(6, 24)).toMatchObject({
      meetings: 4,
      leagueRounds: 20,
      tail: { kind: 'seeded_playoff_window', rounds: 4 },
    })
    for (const key of ['leagueRounds', 'leftoverRounds', 'seeded_playoff_window']) {
      expect(format).toContain(key)
    }
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
    expect(selectCupFormat(10, 30)).toMatchObject({
      meetings: 2,
      tail: { kind: 'seeded_playoff_window', rounds: 12 },
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
    })
    expect(selectCupFormat(25, 38)).toMatchObject({ groupSizes: [13, 12] })
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
