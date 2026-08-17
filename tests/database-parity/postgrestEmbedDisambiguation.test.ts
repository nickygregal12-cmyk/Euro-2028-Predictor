import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { at } from '../support/indexed'

/**
 * Every PostgREST embed in application code must name the foreign key it
 * traverses.
 *
 * PostgREST resolves `parent:table(...)` by searching for a relationship between
 * the two tables. Where exactly one foreign key exists the embed is unambiguous
 * and the short form works. Where two exist it refuses the whole request with
 * `PGRST201` rather than choosing, and the caller sees an HTTP 300 — not an
 * empty result, not a partial one. Any surface built on that query fails to
 * render.
 *
 * This is not hypothetical. Stage C1 adds composite same-competition-season
 * foreign keys alongside the original single-column ones, which creates a second
 * relationship for 39 child/parent pairs at contract 65 — including
 * `group_teams -> teams`, which `fetchTournamentData` embeds. An unqualified
 * embed there took out 37 authenticated browser journeys, because the Predict
 * surface could not load its teams.
 *
 * The schema change was correct; the embed was merely under-specified. Naming
 * the key is valid against both contracts and costs nothing, so the rule is
 * "always name it" rather than "name it once a second key appears" — the latter
 * only tells you after a migration has already broken a surface.
 *
 * Stage C1b adds further competition/game membership keys, so this recurs unless
 * it is enforced.
 */

const repositoryRoot = process.cwd()

/** Matches a PostgREST embed: `alias:table(` or a bare `table(` inside a select. */
const embedPattern = /(?:([A-Za-z_][A-Za-z0-9_]*)\s*:\s*)?([a-z_][a-z0-9_]*)\s*(!\s*[a-z_][a-z0-9_]*)?\s*\(/g

function trackedSourceFiles(): string[] {
  return execFileSync('git', ['ls-files', 'src', 'e2e', 'tests', 'scripts'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => /\.(ts|tsx)$/.test(file))
    .filter((file) => !file.endsWith('postgrestEmbedDisambiguation.test.ts'))
}

type Embed = { file: string; select: string; parent: string; disambiguated: boolean }

/**
 * Collects `.select('...')` arguments and reads the embeds out of them. Only
 * string literals are considered; a dynamically built select would not be
 * checkable here and none currently exists.
 */
function embedsIn(file: string): Embed[] {
  const source = readFileSync(resolve(repositoryRoot, file), 'utf8')
  const found: Embed[] = []

  for (const selectMatch of source.matchAll(/\.select\(\s*'([^']*)'/g)) {
    const select = at(selectMatch, 1)
    if (!select.includes('(')) continue

    for (const embed of select.matchAll(embedPattern)) {
      found.push({
        file,
        select,
        parent: at(embed, 2),
        disambiguated: Boolean(embed[3]),
      })
    }
  }

  return found
}

function allEmbeds(): Embed[] {
  return trackedSourceFiles().flatMap(embedsIn)
}

describe('PostgREST embeds', () => {
  it('names the foreign key for every embed, so an added composite key cannot make it ambiguous', () => {
    const underSpecified = allEmbeds()
      .filter((embed) => !embed.disambiguated)
      .map((embed) => `${embed.file}: ${embed.parent} in "${embed.select}"`)

    expect(underSpecified).toEqual([])
  })

  it('still finds the embeds it is meant to be guarding', () => {
    // A regression here means the detector stopped matching, which would make
    // the assertion above pass vacuously.
    expect(allEmbeds().length).toBeGreaterThan(0)
  })

  it('recognises both the qualified and unqualified forms', () => {
    const parse = (select: string) =>
      [...select.matchAll(embedPattern)].map((match) => ({
        parent: match[2],
        disambiguated: Boolean(match[3]),
      }))

    expect(parse('slot, group_id, team:teams(id, name)')).toEqual([
      { parent: 'teams', disambiguated: false },
    ])
    expect(parse('slot, group_id, team:teams!group_teams_team_id_fkey(id, name)')).toEqual([
      { parent: 'teams', disambiguated: true },
    ])
    expect(parse('id, letter')).toEqual([])
  })
})
