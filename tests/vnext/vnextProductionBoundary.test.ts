import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromRoot, reachableFrom } from '../app/importGraph'

/**
 * vNext IS A PARALLEL LANE, AND THIS IS THE THING THAT KEEPS IT PARALLEL.
 *
 * `src/vnext/AGENTS.md` says the workshop "is not wired into the running
 * product", and until now nothing failed if it became so. That mattered less
 * when vNext was four components; Stage 3 added three whole Home compositions,
 * and the way a design workshop stops being isolated is never a decision — it
 * is one import added from a production surface because a component looked
 * reusable, which then ships an unapproved design language and its tokens in
 * the production bundle while looking like an ordinary refactor.
 *
 * Same shape as `parkedEuroBoundary` and `premiumPrototypeBoundary`, and for
 * the same reason: a parallel tree that must not be wired in needs a test
 * saying so, because a comment does not fail.
 *
 * The `src/dev/` stop is the same one those suites need — the harnesses there
 * are behind `import.meta.env.DEV`, which Vite replaces with `false`, so the
 * branch is dead code in a production build. A static walker cannot see a
 * build-time constant.
 */

const repositoryRoot = process.cwd()

function filesUnder(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...filesUnder(path))
    else if (/\.tsx?$/.test(path)) out.push(path)
  }
  return out
}

const vnextFiles = filesUnder(resolve(repositoryRoot, 'src/vnext'))
const productionGraph = reachableFrom(resolve(repositoryRoot, 'src/main.tsx'), {
  stopAt: ['/src/dev/'],
})

/**
 * THE ONE PLACE vNEXT IS ALLOWED TO KNOW THE APPLICATION EXISTS.
 *
 * Stage 6 connected Home to real reads, which means something under `src/vnext/`
 * now imports `src/features/` and `src/services/` on purpose. The blanket ban
 * this suite used to hold could not express that, so it becomes DIRECTIONAL
 * rather than being deleted — which is the more useful rule anyway.
 *
 * `integration/` is the adapter. It may reach the application, because reaching
 * the application is its entire job. Nothing else may: the components, the
 * models, the shell, the fixtures, the foundations and the stories stay a
 * presentation lane over `HomeModel`, and the direction of every import stays
 *
 *   components → models          integration → application services
 *
 * and never `components → services`. That is what keeps `VNextHome({ model })`
 * renderable in Storybook, in jsdom and in a test with no database, and it is
 * what the second half of this suite now measures.
 */
const INTEGRATION = '/src/vnext/integration/'
const presentationFiles = vnextFiles.filter((file) => !file.includes(INTEGRATION))

describe('the vNext workshop', () => {
  it('finds the tree and the graph, so the boundary is not vacuous', () => {
    // A renamed directory or a broken walk would otherwise empty this suite and
    // take the boundary with it.
    expect(vnextFiles.length).toBeGreaterThan(25)
    expect(productionGraph.size).toBeGreaterThan(100)
  })

  /**
   * THE ONE PRODUCTION SURFACE, AND WHY IT IS ONE RATHER THAN NONE.
   *
   * `/about` is a real route. ADR 0017 asks for *"an unambiguous non-affiliation
   * statement in the footer and terms"* and the product has published neither —
   * an obligation the product owes as it stands, signed in and signed out,
   * rather than one that waits for a cutover. It is an ADDITION: no legacy
   * journey loses an address, no redirect changes and no existing route serves
   * anything different.
   *
   * So the blanket rule becomes a BOUNDED one rather than being deleted, and
   * the bound is the interesting half. What may ship is the shell, the
   * foundations, the models and the About surface itself. What may NOT is any
   * vNext PAGE — Home, Matches, the Match Predictor, Leagues, the player
   * profile, Last Man Standing, the Championship, Games, Discovery, Invite,
   * onboarding — because those are the surfaces the cutover decides, and one of
   * them arriving in the production graph is precisely the accident this suite
   * was written to catch.
   *
   * A wildcard would have made this vacuous. The list is by directory and the
   * page directories are named, so adding a page import to a production surface
   * still fails here.
   */
  const PRODUCTION_ADMITTED = [
    '/src/vnext/about/',
    '/src/vnext/app/',
    '/src/vnext/components/',
    '/src/vnext/foundations/',
    '/src/vnext/models/',
    '/src/vnext/states/',
    '/src/vnext/fixtures/about/',
    '/src/vnext/integration/about/',
    '/src/vnext/integration/shell/',
  ]

  const FORBIDDEN_IN_PRODUCTION = [
    '/src/vnext/home/',
    '/src/vnext/matches/',
    '/src/vnext/predictor/',
    '/src/vnext/leagues/',
    '/src/vnext/player/',
    '/src/vnext/lms/',
    '/src/vnext/championship/',
    '/src/vnext/games/',
    '/src/vnext/discovery/',
    '/src/vnext/invite/',
    '/src/vnext/onboarding/',
    '/src/vnext/account/',
    '/src/vnext/ia/',
    '/src/vnext/workshop/',
    '/src/vnext/stories/',
  ]

  it('reaches production only through the one routed vNext surface', () => {
    const reachable = vnextFiles.filter((file) => productionGraph.has(file))
    const unexpected = reachable.filter(
      (file) => !PRODUCTION_ADMITTED.some((tree) => file.includes(tree)),
    )

    expect(
      unexpected.map(fromRoot),
      'these vNext modules are reachable from src/main.tsx and are not part of ' +
        'the routed About surface — a production surface has imported one, ' +
        'which ships an unapproved design language and its tokens in the ' +
        'production bundle',
    ).toEqual([])
  })

  it('keeps every vNext PAGE out of the production graph', () => {
    // The half that still holds the cutover. The stage that repoints Home,
    // Matches, Games and Leagues is the stage that changes this case, and it
    // will be doing so on purpose.
    const leaked = vnextFiles.filter(
      (file) =>
        productionGraph.has(file) &&
        FORBIDDEN_IN_PRODUCTION.some((tree) => file.includes(tree)),
    )

    expect(
      leaked.map(fromRoot),
      'a vNext PAGE is reachable from src/main.tsx — the Football Hub cutover ' +
        'is Stage 14 work under explicit authority, not something a route ' +
        'addition performs by accident',
    ).toEqual([])
  })

  it('proves the About surface really is routed, so the allowance is not dead', () => {
    // If `/about` were removed, the allowance above would silently become a
    // permission nothing uses — and the next route addition would inherit it.
    const about = resolve(repositoryRoot, 'src/vnext/about/VNextAbout.tsx')
    expect(productionGraph.has(about), 'src/vnext/about is not routed').toBe(true)
  })

  it('keeps a presentation lane that never reaches the application', () => {
    // vNext presentation is allowed to use React, Framer Motion and lucide — the
    // dependencies the repository already has. It is not allowed to reach into
    // `src/features/`, `src/services/` or the legacy design system: the whole
    // premise is a presentation lane over a typed model, and an import from any
    // of those is either a Supabase dependency arriving by the back door or a
    // visual inheritance the lane exists to avoid.
    //
    // `integration/` is excluded because it is the adapter, and the case below
    // holds the direction that makes that safe.
    const forbidden = ['/src/features/', '/src/services/', '/src/design-system/']
    const offenders: string[] = []

    for (const file of presentationFiles) {
      for (const reached of reachableFrom(file)) {
        if (forbidden.some((tree) => reached.includes(tree))) {
          offenders.push(`${fromRoot(file)} -> ${fromRoot(reached)}`)
        }
      }
    }

    expect(
      [...new Set(offenders)],
      'a vNext presentation module reached into the production app — move the ' +
        'read into src/vnext/integration/ and pass the result in as model data',
    ).toEqual([])
  })

  it('finds the presentation lane and the adapter, so neither case is vacuous', () => {
    // A renamed `integration/` would silently turn the case above back into the
    // blanket rule and the case below into a no-op, and both would pass.
    expect(presentationFiles.length).toBeGreaterThan(25)
    expect(vnextFiles.length).toBeGreaterThan(presentationFiles.length)
  })

  it('keeps Supabase out of every vNext visual component', () => {
    // The narrower, louder version of the rule above, and the one §7 of the
    // Stage 6 brief states in terms: no `supabase.from(...)`, no client import,
    // no generated database types anywhere in the visual tree. It is checked by
    // reach rather than by grep because the defect is never a direct import — it
    // is a component importing a helper that imports the client.
    const visual = presentationFiles.filter(
      (file) =>
        file.includes('/src/vnext/home/') ||
        // Stage 7's page joins the list on the same terms as Home's: it takes a
        // `PredictorModel` and nothing else, and the adapter beside it is the only
        // thing that knows the application exists.
        file.includes('/src/vnext/predictor/') ||
        // Stage 8's Matches and Match Centre, on the same terms again. They take
        // a `MatchesModel` / `MatchCentreModel` and nothing else — which is what
        // keeps every deterministic world renderable in jsdom with no database.
        file.includes('/src/vnext/matches/') ||
        file.includes('/src/vnext/app/') ||
        file.includes('/src/vnext/components/'),
    )
    const banned = [
      '/src/services/supabase/',
      '/services/supabase/client',
      'database.types',
    ]
    const offenders: string[] = []

    for (const file of visual) {
      for (const reached of reachableFrom(file)) {
        if (banned.some((fragment) => reached.includes(fragment))) {
          offenders.push(`${fromRoot(file)} -> ${fromRoot(reached)}`)
        }
      }
    }

    expect(visual.length).toBeGreaterThan(15)
    expect(
      [...new Set(offenders)],
      'a vNext visual component can reach Supabase — Home components take a ' +
        'HomeModel and nothing else',
    ).toEqual([])
  })

  it('keeps the Match Predictor renderable without its adapter', () => {
    // THE SAME PROPERTY AS HOME'S BELOW, AND FOR THE SAME REASON. If
    // `VNextMatchPredictor` could reach `integration/`, every deterministic story
    // and every render test would drag the season services — and their Supabase
    // client — into a jsdom run, and the surface would have quietly become
    // network-dependent. The dependency runs the other way: the adapter imports
    // the page, never the reverse.
    const predictor = reachableFrom(
      resolve(repositoryRoot, 'src/vnext/predictor/VNextMatchPredictor.tsx'),
    )
    const leaked = [...predictor].filter((file) => file.includes(INTEGRATION))

    expect(
      leaked.map(fromRoot),
      'VNextMatchPredictor reached the integration layer — the dependency runs ' +
        'the other way: the adapter imports the page, never the reverse',
    ).toEqual([])
  })

  it('keeps the Storybook rehearsal out of the product', () => {
    // `fixtures/predictor/rehearse.ts` exists so a story can actually be typed
    // into. It is a harness, and a harness that a real surface imported would be a
    // second source of truth about what a command does — the thing the file's own
    // header says it is not.
    const consumers = [
      ...filesUnder(resolve(repositoryRoot, 'src/vnext/predictor')),
      ...filesUnder(resolve(repositoryRoot, 'src/vnext/integration')),
    ]
    const offenders = consumers.filter((file) =>
      [...reachableFrom(file)].some((reached) => reached.includes('/fixtures/predictor/rehearse')),
    )

    expect(
      offenders.map(fromRoot),
      'a predictor surface or adapter reached the Storybook rehearsal — it is a ' +
        'review harness and must never decide what a command does',
    ).toEqual([])
  })

  it('keeps Matches and the Match Centre renderable without their adapter', () => {
    // THE SAME PROPERTY AS HOME'S AND THE PREDICTOR'S, AND FOR THE SAME REASON.
    // If either page could reach `integration/`, every deterministic story and
    // every render test would drag the season services — and their Supabase
    // client — into a jsdom run, and the surfaces would have quietly become
    // network-dependent. The dependency runs the other way: the adapter imports
    // the page, never the reverse.
    for (const page of ['VNextMatches.tsx', 'VNextMatchCentre.tsx']) {
      const reached = reachableFrom(resolve(repositoryRoot, `src/vnext/matches/${page}`))
      const leaked = [...reached].filter((file) => file.includes(INTEGRATION))

      expect(
        leaked.map(fromRoot),
        `${page} reached the integration layer — the dependency runs the other ` +
          'way: the adapter imports the page, never the reverse',
      ).toEqual([])
    }
  })

  it('keeps the approved Home renderable without the adapter', () => {
    // THE PROPERTY THAT MATTERS MOST, and the one a reader of this suite should
    // take away: `VNextHome` must not know that an adapter exists. If it did,
    // every deterministic story and every visual test would drag the season
    // services — and their Supabase client — into a jsdom run, and the Gold
    // Standard surface would have quietly become network-dependent.
    const home = reachableFrom(resolve(repositoryRoot, 'src/vnext/home/VNextHome.tsx'))
    const leaked = [...home].filter((file) => file.includes(INTEGRATION))

    expect(
      leaked.map(fromRoot),
      'VNextHome reached the integration layer — the dependency runs the other ' +
        'way: the adapter imports Home, never the reverse',
    ).toEqual([])
  })
})
