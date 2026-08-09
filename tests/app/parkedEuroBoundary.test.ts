import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARKED_EURO_SPECS } from '../../scripts/select-browser-journeys.mjs'
import { fromRoot, reachableFrom } from './importGraph'

/**
 * The retired Euro 2028 journeys, and the boundary that keeps them retired.
 *
 * WHY THEY ARE STILL HERE. `src/App.tsx` no longer registers `/predict`,
 * `/matches` (the tournament one), `/match/:matchRef`, `/games`, `/league/overall`,
 * `/prediction-trends` or `/competitions/euro/2028/original`, so the pages
 * behind them are unreachable from the weekly application. They are NOT dead
 * code: `MASTER-TODO.md` parks the remaining Euro scope until January 2028, the
 * `euro-2028-baseline` tag is the recovery point, and `PARKED_EURO_SPECS`
 * retains their browser journeys as return evidence rather than deleting them.
 * Deleting the source would destroy the thing those specs are evidence for.
 *
 * WHAT WAS MISSING WAS THE GUARD. `e2eProjectGating` proves the parked SPECS
 * stay out of the weekly suite; nothing proved the parked SOURCE stays out of
 * the weekly application. Those are different facts, and the second is the one
 * that would ship: an import added from any weekly surface — a shared helper
 * borrowed from `features/predict`, a card lifted from `features/matches` —
 * puts a retired journey back in the production bundle while looking like an
 * ordinary refactor.
 *
 * Same shape as `premiumPrototypeBoundary.test.ts`, and for the same reason:
 * a parallel tree that must not be wired in needs a test saying so, because a
 * comment does not fail.
 */

const repositoryRoot = process.cwd()

/**
 * The retired journeys. Directories rather than files, so a module added to one
 * of them tomorrow inherits the boundary instead of slipping under it.
 */
const PARKED_EURO_TREES = [
  'src/features/predict',
  'src/features/matches',
  'src/features/games',
  'src/features/bracket',
  'src/features/trends',
  'src/features/home',
] as const

/**
 * Retired individually rather than as a whole directory: `src/features/league`
 * and `src/features/leagues` both still serve live weekly routes.
 */
const PARKED_EURO_MODULES = [
  'src/features/league/LeaguePage.tsx',
  'src/features/league/OverallStandingsPage.tsx',
] as const

/**
 * Inside a parked tree and NOT parked, because they are tournament rules rather
 * than a retired journey's screens, and routes that are still mounted use them.
 *
 * `bracketPipeline` derives the knockout bracket and the profile, account and
 * share surfaces all consume it; `matchScoring` scores one Euro match and the
 * profile pages call it directly; `venues` maps a venue to a country code and
 * the pipeline reads it. Listing them as
 * parked would make this suite fail for the wrong reason and invite the wrong
 * fix: moving live logic rather than removing a dead import.
 *
 * That they live under `features/predict` at all is a placement question, not a
 * boundary one. CLAUDE.md puts tournament rules in `src/domain/tournament/`, so
 * there is a move to make here one day; it is recorded rather than done, since
 * it touches six call sites and this change is about the boundary.
 */
const SHARED_TOURNAMENT_LOGIC = [
  'src/features/bracket/bracketPipeline.ts',
  'src/features/predict/matchScoring.ts',
  'src/features/predict/venues.ts',
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

const shared = SHARED_TOURNAMENT_LOGIC.map((file) => resolve(repositoryRoot, file))

const parkedFiles = [
  ...PARKED_EURO_TREES.flatMap((tree) => filesUnder(resolve(repositoryRoot, tree))),
  ...PARKED_EURO_MODULES.map((file) => resolve(repositoryRoot, file)),
].filter((file) => !shared.includes(file))

/**
 * What the production bundle can reach.
 *
 * THE DEV HARNESSES ARE A STOP, NOT AN OVERSIGHT, and the first version of this
 * file found out why: `src/dev/ComponentsPreview.tsx` legitimately renders
 * `TodayCard`, `StatStrip`, `CatchUpLine`, `LeagueSnapshot` and the bracket
 * pieces, because it is the component gallery and those are components. It is
 * mounted behind `import.meta.env.DEV`, which Vite replaces with `false`, so
 * the whole branch is dead code in a production build — but a static walker
 * cannot see a build-time constant, and without the stop it reported twelve
 * parked modules as shipping.
 */
const productionGraph = reachableFrom(resolve(repositoryRoot, 'src/main.tsx'), {
  stopAt: ['/src/dev/'],
})

describe('the parked Euro journeys', () => {
  it('finds the trees, so the boundary is not vacuous', () => {
    // A renamed or moved directory would otherwise silently empty this suite
    // and take the boundary with it.
    expect(parkedFiles.length).toBeGreaterThan(20)
    expect(productionGraph.size).toBeGreaterThan(100)
  })

  it('is unreachable from the production entry', () => {
    const reachable = parkedFiles.filter((file) => productionGraph.has(file))
    expect(
      reachable.map(fromRoot),
      'these retired Euro modules are reachable from src/main.tsx — a weekly ' +
        'surface has imported one, which puts a route this milestone retired ' +
        'back into the production bundle',
    ).toEqual([])
  })

  it('is not registered as a route', () => {
    // The routes were removed from App.tsx; this stops one coming back by the
    // front door as well as by an import.
    const app = readFileSync(resolve(repositoryRoot, 'src/App.tsx'), 'utf8')
    for (const retired of [
      '"/predict',
      '"/match/',
      '"/games',
      '"/league/overall"',
      '"/prediction-trends"',
      '"/competitions/euro',
    ]) {
      expect(app, `src/App.tsx registers the retired route ${retired}`).not.toContain(
        `path=${retired}`,
      )
    }
  })

  it('keeps its browser journeys parked beside it', () => {
    // The specs and the source are one decision. Parking the journeys while
    // deleting what they exercise, or keeping the source with no evidence it
    // ever worked, are both halves of a thing that only makes sense whole.
    expect([...(PARKED_EURO_SPECS as string[])].length).toBeGreaterThan(5)
  })

  it('does not reach into a weekly surface from the other direction either', () => {
    // A parked module importing a live one is fine and expected — they share
    // the design system. A parked module importing the SEASON tree is not: it
    // would mean the retired journey had grown a dependency on the current
    // product, which is how a "quick" deletion later turns into a refactor.
    const offenders: string[] = []
    for (const file of parkedFiles) {
      for (const reached of reachableFrom(file)) {
        if (reached.includes('/src/features/season/')) {
          offenders.push(`${fromRoot(file)} -> ${fromRoot(reached)}`)
        }
      }
    }
    expect(
      [...new Set(offenders)],
      'a parked Euro module depends on the season tree',
    ).toEqual([])
  })
})
