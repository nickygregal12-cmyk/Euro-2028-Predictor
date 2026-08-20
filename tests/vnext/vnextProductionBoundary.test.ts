import { readFileSync, readdirSync, statSync } from 'node:fs'
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

/**
 * THE ONE SANCTIONED SEAM, AND WHY IT IS NOT A HOLE IN THIS RULE.
 *
 * Stage 14 is the cutover: the stage whose entire job is to give vNext surfaces
 * a production behaviour. So from Stage 14 onward "vNext is unreachable from
 * production" cannot be literally true, and a guard that has to be DELETED the
 * first time the programme reaches its own goal was never protecting anything.
 *
 * It is narrowed instead, exactly as this suite was already narrowed once —
 * Stage 6 turned a blanket ban into a directional rule when `integration/`
 * legitimately needed the application. Same move, same reason.
 *
 * READ THE FAILURE MODE THIS SUITE NAMES, because the narrowing is built to
 * keep catching it: *"one import added from a production surface because a
 * component looked reusable … while looking like an ordinary refactor."* That
 * is an ACCIDENT, made anywhere, by anyone, in a diff that reads as tidying.
 * A cutover is its opposite — deliberate, contracted, flag-gated, and argued
 * for in `docs/product/vnext-route-migration-matrix.md` §13.
 *
 * So `src/app/vnext/` is stopped at, exactly as `src/dev/` is, and the original
 * assertion below is then made VERBATIM against the rest of the tree. Every
 * accidental import from anywhere else still fails it. What the seam buys is
 * one door; the cases after it prove that door is the only one, that it is
 * lazy, and that it is flag-gated.
 */
const CUTOVER_SEAM = '/src/app/vnext/'
const productionGraph = reachableFrom(resolve(repositoryRoot, 'src/main.tsx'), {
  stopAt: ['/src/dev/', CUTOVER_SEAM],
})
const seamFiles = filesUnder(resolve(repositoryRoot, 'src/app/vnext'))
const appTsx = readFileSync(resolve(repositoryRoot, 'src/App.tsx'), 'utf8')

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
   * THE TWO PRODUCTION SURFACES, AND WHY THE RULE IS BOUNDED RATHER THAN GONE.
   *
   * `/about` is a real route. ADR 0017 asks for *"an unambiguous non-affiliation
   * statement in the footer and terms"* and the product has published neither —
   * an obligation the product owes as it stands, signed in and signed out,
   * rather than one that waits for a cutover.
   *
   * THE PUBLIC LANDING PAGE IS THE SECOND, AND IT IS A DIFFERENT KIND OF CASE.
   * It does not ROUTE to a vNext page; it MOUNTS four of them inside an inert
   * device frame, as the picture of the product an anonymous visitor is shown
   * before they have an account to look at. It had to: the page it replaced drew
   * its own miniature of a "Hub / Predict / More" navigation the product had
   * stopped having, which is the failure mode a hand-drawn preview always
   * eventually reaches. Mounting the real surfaces is what makes the marketing
   * page unable to go stale, and it is why these four directories are admitted
   * here rather than a fifth copy of them being written.
   *
   * ============================ THE HALF THAT STILL HOLDS THE CUTOVER ======
   *
   * The interesting bound is no longer "no vNext page is in the bundle" — the
   * landing page put four of them there on purpose. It is the case below:
   * NO vNEXT PAGE IS REACHABLE FROM THE APPLICATION'S OWN ROUTES. Walking from
   * `src/main.tsx` while refusing to enter the landing page's own directory
   * leaves the graph the signed-in product is served from, and a vNext page
   * appearing THERE is the cutover happening by accident, which is what this
   * suite exists to refuse.
   *
   * A wildcard would have made this vacuous. Both lists are by directory and
   * every page directory is named in one of them.
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
    // The public landing page's product preview, and the deterministic world it
    // renders. `fixtures/marketing/` reaches the other fixture families, which
    // is why the whole fixtures tree is admitted rather than one directory of
    // it: a marketing world assembled from anything OTHER than the review lane's
    // own curated worlds would be the second copy this change exists to delete.
    '/src/vnext/fixtures/',
    '/src/vnext/home/',
    '/src/vnext/matches/',
    '/src/vnext/leagues/',
    '/src/vnext/games/',
    // Games composes the scoring explainer, so it comes with it. That is the
    // right answer rather than a concession: "what do I get for the right
    // score?" is the question an acquisition page most owes an answer to, and
    // the answer a visitor reads is the one the product gives — it reads the
    // domain's own `SEASON_PREDICTOR_POINTS` rather than restating it.
    '/src/vnext/rules/',
  ]

  /**
   * The page directories that may not reach production AT ALL, landing page
   * included. Four of the twelve moved to `PRODUCTION_ADMITTED` above; these
   * eight did not, and nothing on a public page has any business showing a
   * player's profile, an invite, an onboarding flow or an account.
   */
  const FORBIDDEN_IN_PRODUCTION = [
    '/src/vnext/predictor/',
    '/src/vnext/player/',
    '/src/vnext/lms/',
    '/src/vnext/championship/',
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

  it('keeps the pages nothing public may show out of the production graph', () => {
    const leaked = vnextFiles.filter(
      (file) =>
        productionGraph.has(file) &&
        FORBIDDEN_IN_PRODUCTION.some((tree) => file.includes(tree)),
    )

    expect(
      leaked.map(fromRoot),
      'a vNext surface that is neither routed nor part of the landing preview ' +
        'is reachable from src/main.tsx',
    ).toEqual([])
  })

  it('proves the landing preview really does mount the four, so the allowance is not dead', () => {
    // The mirror of the About case below. If the preview were deleted or quietly
    // reduced to a picture again, the four allowances above would become
    // permissions nothing uses — and the next import would inherit them.
    for (const page of [
      'src/vnext/home/VNextHome.tsx',
      'src/vnext/matches/VNextMatches.tsx',
      'src/vnext/leagues/VNextLeagues.tsx',
      'src/vnext/games/VNextGames.tsx',
    ]) {
      expect(
        productionGraph.has(resolve(repositoryRoot, page)),
        `${page} is not in the landing preview`,
      ).toBe(true)
    }
  })

  it('proves the About surface really is routed, so the allowance is not dead', () => {
    // If `/about` were removed, the allowance above would silently become a
    // permission nothing uses — and the next route addition would inherit it.
    const about = resolve(repositoryRoot, 'src/vnext/about/VNextAbout.tsx')
    expect(productionGraph.has(about), 'src/vnext/about is not routed').toBe(true)
  })

  it('reaches vNext through the cutover seam and nowhere else', () => {
    // The seam is a door, not a hole, and this is what makes the difference
    // checkable. Walk production WITHOUT stopping at `src/app/vnext/`, then
    // subtract everything the seam legitimately pulls in: whatever is left is
    // a second route into vNext, which is the accident this suite exists for.
    const withSeam = reachableFrom(resolve(repositoryRoot, 'src/main.tsx'), {
      stopAt: ['/src/dev/'],
    })
    const throughSeam = new Set<string>()
    for (const file of seamFiles) {
      for (const reached of reachableFrom(file)) throughSeam.add(reached)
    }
    // THE PUBLIC LANDING PAGE IS THE SECOND DOOR, and it is a door rather than
    // a hole for the same reason the seam is: it is deliberate, it is argued
    // for, and it is bounded. Its product preview mounts four vNext surfaces
    // inside an inert device frame so a marketing page cannot advertise an
    // information architecture the product has stopped having. Subtracted here
    // by the same construction as the seam, so everything it does NOT pull in
    // still fails this case.
    //
    // `/about` IS THE THIRD, and the oldest. It is a routed page rather than a
    // cutover adapter, because ADR 0017's non-affiliation statement is owed by
    // the product as it stands rather than by the stage that changes its shape.
    const otherEntries = [
      'src/features/landing/ProductPreview.tsx',
      'src/features/about/AboutPage.tsx',
    ]
    const throughOtherDoors = new Set<string>()
    for (const entry of otherEntries) {
      for (const reached of reachableFrom(resolve(repositoryRoot, entry))) {
        throughOtherDoors.add(reached)
      }
    }
    const otherDoors = vnextFiles.filter(
      (file) => withSeam.has(file) && !throughSeam.has(file) && !throughOtherDoors.has(file),
    )
    expect(
      otherDoors.map(fromRoot),
      'these vNext modules reach production by some path other than the ' +
        'flag-gated cutover adapters in src/app/vnext/ — that is the ' +
        '"looked reusable" import this suite exists to catch',
    ).toEqual([])
  })

  it('enters the seam lazily, so vNext cannot join the entry chunk', () => {
    // MEASURED, NOT ASSUMED. Imported statically the Stage 14 adapters moved
    // the entry chunk 240.19 kB → 428.67 kB raw (75.81 → 133.27 kB gzip): a
    // 78% increase paid by every visitor, for a surface that cannot render
    // while the flag is off. `isNextUi(...)` is a function call, so no bundler
    // can shake it out. Lazy is therefore load-bearing rather than tidy, and a
    // future static import would silently undo it.
    expect(seamFiles.length).toBeGreaterThan(0)
    const statically = new RegExp(`^import\\s[^;]*from '\\.${CUTOVER_SEAM.replace('/src', '')}`, 'm')
    expect(
      statically.test(appTsx),
      'src/App.tsx must reach src/app/vnext/ only through lazy(() => import(...))',
    ).toBe(false)
    expect(appTsx).toMatch(/lazy\(\(\) =>\s*import\('\.\/app\/vnext\//)
  })

  it('gates every seam route behind a rollback flag', () => {
    // A cutover adapter that is mounted unconditionally is a cutover, not a
    // switch — and the release gate this programme works to is that a flag
    // restores the prior journey with no data rollback. Every element the seam
    // exports must therefore appear opposite a legacy element under a flag.
    const exported = seamFiles
      .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/export function (VNext\w+)/g)])
      .map((match) => match[1])
    expect(exported.length).toBeGreaterThan(0)
    for (const element of exported) {
      const mounted = appTsx.includes(`<${element} />`)
      if (!mounted) continue
      const guarded = new RegExp(`isNextUi\\('[a-zA-Z]+'\\)[\\s\\S]{0,200}<${element} />`)
      expect(guarded.test(appTsx), `${element} is routed without a rollback flag`).toBe(true)
    }
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
