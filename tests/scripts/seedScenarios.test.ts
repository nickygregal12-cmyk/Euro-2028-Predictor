import { describe, expect, it } from 'vitest'
import { buildFixture } from '../../scripts/seed-dev/fixture'
import { generateSeedData } from '../../scripts/seed-dev/generate'
import {
  applyScenario,
  isScenarioName,
  readScenario,
  SCENARIOS,
  SCENARIO_NAMES,
} from '../../scripts/seed-dev/scenarios'
import { rankScored, scoreEntries } from '../../scripts/seed-dev/scoreEntries'

const fixture = buildFixture()

/**
 * The seed is reviewed against `docs/design-system.md`'s hostile-data rule. Three
 * of the states that rule NAMES were previously impossible to seed: a tied top,
 * a non-submitter, and a pool too small for a leaderboard to mean anything.
 *
 * These assertions are about the GUARANTEE, not about one lucky seed. Each one
 * fails if the scenario stops forcing the state — proved by removing the forcing
 * and watching it go red, recorded in the pull request.
 */
describe('seed scenarios', () => {
  it('names every scenario it exposes, and recognises nothing else', () => {
    expect(SCENARIO_NAMES).toEqual(['standard', 'contested', 'sparse'])
    for (const name of SCENARIO_NAMES) expect(isScenarioName(name)).toBe(true)
    expect(isScenarioName('production')).toBe(false)
    expect(isScenarioName('')).toBe(false)
  })

  it('stays deterministic — same scenario and seed, same data', () => {
    for (const name of SCENARIO_NAMES) {
      const once = applyScenario(fixture, generateSeedData(fixture), name)
      const twice = applyScenario(fixture, generateSeedData(fixture), name)
      expect(twice).toEqual(once)
    }
  })

  describe('standard', () => {
    it('changes no prediction and no result, and leaves everyone submitted', () => {
      const base = generateSeedData(fixture)
      const applied = applyScenario(fixture, base, 'standard')

      expect(applied.results).toEqual(base.results)
      expect(applied.entries.map((entry) => entry.groupMatches)).toEqual(
        base.entries.map((entry) => entry.groupMatches),
      )
      expect(applied.entries.every((entry) => entry.submitted)).toBe(true)
    })

    it('leaves the top of the table uncontested, which is why `contested` exists', () => {
      const ranked = rankScored(
        scoreEntries(fixture, applyScenario(fixture, generateSeedData(fixture), 'standard')),
      )
      const top = ranked.filter((entry) => entry.rank === 1)
      expect(top).toHaveLength(1)
    })
  })

  describe('contested', () => {
    it('guarantees at least two entries share the highest total', () => {
      const ranked = rankScored(
        scoreEntries(fixture, applyScenario(fixture, generateSeedData(fixture), 'contested')),
      )
      const best = ranked[0]
      if (best === undefined) throw new Error('the contested scenario scored no entries')

      const sharingTheTop = ranked.filter((entry) => entry.total === best.total)
      expect(sharingTheTop.length).toBeGreaterThanOrEqual(2)
      // Distinct players, not one entry counted twice — the whole point is that a
      // human sees two names level.
      expect(new Set(sharingTheTop.map((entry) => entry.displayName)).size).toBe(
        sharingTheTop.length,
      )
    })

    it('ties by construction rather than by touching the scoring pipeline', () => {
      const applied = applyScenario(fixture, generateSeedData(fixture), 'contested')
      const ranked = rankScored(scoreEntries(fixture, applied))
      const best = ranked[0]
      if (best === undefined) throw new Error('the contested scenario scored no entries')

      const levelNames = ranked
        .filter((entry) => entry.total === best.total)
        .map((entry) => entry.displayName)
      const levelEntries = applied.entries.filter((entry) =>
        levelNames.includes(entry.displayName),
      )
      const [first, second] = levelEntries
      if (first === undefined || second === undefined) {
        throw new Error('expected two level entries to compare')
      }
      // Identical predictions is WHY they are level. Nothing re-implements scoring.
      expect(second.groupMatches).toEqual(first.groupMatches)
      expect(second.displayName).not.toBe(first.displayName)
      expect(second.email).not.toBe(first.email)
    })

    it('still submits everyone — a contested top is not an unsubmitted one', () => {
      const applied = applyScenario(fixture, generateSeedData(fixture), 'contested')
      expect(applied.entries.every((entry) => entry.submitted)).toBe(true)
    })
  })

  describe('sparse', () => {
    it('guarantees at least one entry that was never submitted', () => {
      const applied = applyScenario(fixture, generateSeedData(fixture), 'sparse')
      const unsubmitted = applied.entries.filter((entry) => !entry.submitted)
      expect(unsubmitted.length).toBeGreaterThanOrEqual(1)
      // and not everyone, or the state under review is "an empty tournament"
      expect(unsubmitted.length).toBeLessThan(applied.entries.length)
    })

    it('keeps a non-submitter a real player, with predictions still drafted', () => {
      const applied = applyScenario(fixture, generateSeedData(fixture), 'sparse')
      const unsubmitted = applied.entries.filter((entry) => !entry.submitted)
      for (const entry of unsubmitted) {
        expect(entry.groupMatches).toHaveLength(36)
        expect(entry.displayName.length).toBeGreaterThan(0)
      }
    })

    it('asks for a one-member and a two-member pool', () => {
      expect(SCENARIOS.sparse.extraPoolSizes).toEqual([1, 2])
    })
  })

  it('asks for no extra pools outside the sparse scenario', () => {
    expect(SCENARIOS.standard.extraPoolSizes).toEqual([])
    expect(SCENARIOS.contested.extraPoolSizes).toEqual([])
  })

  describe('reading the scenario from a command line', () => {
    it('defaults to standard, so every existing invocation is unchanged', () => {
      expect(readScenario([])).toBe('standard')
      expect(readScenario(['--commit'])).toBe('standard')
    })

    it('reads each named scenario', () => {
      for (const name of SCENARIO_NAMES) {
        expect(readScenario(['--commit', `--scenario=${name}`])).toBe(name)
      }
    })

    it('REFUSES an unrecognised name rather than seeding the ordinary world', () => {
      // Falling back would be discovered only by a reviewer wondering why the
      // state they asked for is not on the page.
      expect(() => readScenario(['--scenario=contsted'])).toThrow(/Unknown seed scenario/)
      expect(() => readScenario(['--scenario='])).toThrow(/Unknown seed scenario/)
    })

    it('refuses a name that is merely an Object property', () => {
      expect(() => readScenario(['--scenario=constructor'])).toThrow(/Unknown seed scenario/)
      expect(() => readScenario(['--scenario=toString'])).toThrow(/Unknown seed scenario/)
    })
  })
})