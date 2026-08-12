import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARKED_EURO_SPECS } from '../../scripts/select-browser-journeys.mjs'
import { siteConfiguration } from '../../src/app/site/siteConfiguration'
import { VARIANT_ROUTE_OWNERSHIP } from '../../src/app/site/variantRoutes'
import { appSource } from './declaredRoutes'
import { fromRoot, reachableFrom } from './importGraph'

/**
 * The Euro tournament's journeys, and the boundary that keeps them off the Hub.
 *
 * WHAT THIS FILE USED TO SAY, AND WHY IT NO LONGER SAYS IT. Until 11 August 2026
 * the tournament's routes were not registered at all: `MASTER-TODO.md` parked
 * the remaining Euro scope to January 2028, `src/App.tsx` named none of
 * `/predict`, `/match/:matchRef`, `/games`, `/league/overall` or
 * `/prediction-trends`, and this file asserted their ABSENCE — from the route
 * table and from the production import graph alike. That was the right fact
 * while there was no Euro deployment to serve them.
 *
 * ADR 0026 made two products from one commit, and `EURO-001` requires Euro 2028
 * to be completely hidden from the weekly platform — not from the repository.
 * The routes are registered now, on the Euro build, and the fact this file
 * guards changes shape rather than stopping mattering: **the tournament must
 * stay unreachable from the HUB build**. Rewritten, never deleted, exactly as
 * `.github/workflows/euro-browser-journeys.yml` sequenced it.
 *
 * WHY IT IS NOT AN IMPORT-GRAPH FACT ANY MORE, and this is the part worth
 * reading before "improving" it. Both deployments are built from one
 * `src/main.tsx`; the variant is an environment value resolved at build time,
 * not a second entry point. A static walker therefore cannot tell the two builds
 * apart, and any assertion of the form "the Hub bundle does not contain the
 * tournament" would be measuring something the graph does not know. What CAN be
 * asserted, and is, is the control: every tournament surface is reached only
 * through a gate that refuses when `servesEuroTournament` is false, and the Hub
 * sets it false. That is a stronger statement than absence from a bundle,
 * because a guessable URL still resolves against a bundle that omits nothing.
 */

const repositoryRoot = process.cwd()

/**
 * The tournament's own addresses — the ones no weekly surface claims.
 *
 * Every one of them must be registered INSIDE the `TournamentJourney` layout.
 * The four that both products claim are not here: they resolve through
 * `variantRoutes.ts` and are checked separately below, because their element is
 * one component that answers differently per build.
 */
const TOURNAMENT_OWN_ROUTES = [
  '/predict',
  '/predict/groups/:letter',
  '/predict/third-place',
  '/predict/bracket',
  '/predict/jokers',
  '/predict/review',
  '/prediction-trends',
  '/match/:matchRef',
  '/games',
  '/games/knockout',
  '/games/ko-predictor',
  '/games/lms',
  '/games/cup',
  '/league/overall',
  '/league/:id',
  '/h2h/:rivalId',
  '/tournament/profile',
  '/tournament/profile/:playerId',
] as const

/**
 * The tournament's source trees, retained from the version of this file that
 * guarded their absence. They are no longer held out of the bundle — they are
 * the Euro product — but the reverse direction below still matters.
 */
const TOURNAMENT_TREES = [
  'src/features/predict',
  'src/features/matches',
  'src/features/games',
  'src/features/bracket',
  'src/features/trends',
  'src/features/home',
] as const

const TOURNAMENT_MODULES = [
  'src/features/league/LeaguePage.tsx',
  'src/features/league/OverallStandingsPage.tsx',
] as const

function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (/\.tsx?$/.test(path)) out.push(path)
  }
  return out
}

const tournamentFiles = [
  ...TOURNAMENT_TREES.flatMap((tree) => filesUnder(resolve(repositoryRoot, tree))),
  ...TOURNAMENT_MODULES.map((file) => resolve(repositoryRoot, file)),
]

/**
 * The body of the `TournamentJourney` layout element, as text.
 *
 * Text rather than a parsed tree because `declaredRoutes.ts` already reads
 * `App.tsx` as text for every other coverage guard, and a second parser is a
 * second thing to be wrong. The slice runs from the layout's opening tag to the
 * next `<Route element=` that is not one of its children — the admin layout —
 * which is the only structure this assertion needs.
 */
function tournamentJourneyBlock(): string {
  const start = appSource.indexOf('<Route element={<TournamentJourney />}>')
  expect(start, 'App.tsx no longer registers the TournamentJourney layout').toBeGreaterThan(-1)
  const end = appSource.indexOf('<Route element={<RequireAdmin />}>', start)
  expect(end, 'App.tsx no longer registers the admin layout after it').toBeGreaterThan(start)
  return appSource.slice(start, end)
}

describe('the Euro tournament, on the weekly build', () => {
  it('finds the trees, so the boundary is not vacuous', () => {
    expect(tournamentFiles.length).toBeGreaterThan(20)
    expect(reachableFrom(resolve(repositoryRoot, 'src/main.tsx')).size).toBeGreaterThan(100)
  })

  it('is refused by the Hub deployment, which is the whole control', () => {
    // The one value `EURO-001`'s route half turns on. Its absence is what made
    // every other assertion in this file necessary.
    expect(siteConfiguration('hub').servesEuroTournament).toBe(false)
    expect(siteConfiguration('euro').servesEuroTournament).toBe(true)
  })

  it('registers every tournament-only address inside the boundary', () => {
    // Registered on both builds — one static route table — and refused on the
    // Hub by the gate rather than by omission, because omission is not a
    // control: a guessable URL resolves against a table that omits nothing.
    const block = tournamentJourneyBlock()
    const outside: string[] = []
    for (const path of TOURNAMENT_OWN_ROUTES) {
      const registration = `path="${path}"`
      expect(appSource, `App.tsx does not register ${path} at all`).toContain(registration)
      if (!block.includes(registration)) outside.push(path)
    }
    expect(
      outside,
      'these tournament routes are registered outside TournamentJourney, so the ' +
        'Hub deployment gate never sees them',
    ).toEqual([])
  })

  it('gives every shared address a Hub surface that is not the tournament', () => {
    // The four `App.tsx` cannot disambiguate. Their element resolves per build,
    // so the guarantee is in the table: no path the Hub answers may name a Euro
    // surface, and `VariantDestinations` is exhaustive over the union.
    for (const row of VARIANT_ROUTE_OWNERSHIP) {
      expect(row.hub, `${row.path} serves a Euro surface on the Hub`).not.toMatch(/^euro-/)
      expect(row.hub, `${row.path} resolves to one surface on both builds`).not.toBe(row.euro)
    }
  })

  it('keeps its browser journeys with it', () => {
    // The specs and the source are one decision, as they always were. What
    // changed is where they run: `playwright.euro.config.ts` builds the Euro
    // product, which is what turned the flip above from a deletion into a move.
    expect([...(PARKED_EURO_SPECS as string[])].length).toBeGreaterThan(5)
  })

  it('does not reach into the season tree from the other direction', () => {
    // Unchanged, and still the useful direction. A tournament module importing
    // a live one is fine — they share the design system. Importing the SEASON
    // tree is not: the two products are separate deployments now, and a
    // dependency from one into the other is how that stops being true.
    const offenders: string[] = []
    for (const file of tournamentFiles) {
      for (const reached of reachableFrom(file)) {
        if (reached.includes('/src/features/season/')) {
          offenders.push(`${fromRoot(file)} -> ${fromRoot(reached)}`)
        }
      }
    }
    expect([...new Set(offenders)], 'a tournament module depends on the season tree').toEqual([])
  })
})
