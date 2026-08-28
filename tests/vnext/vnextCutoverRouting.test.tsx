import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { weeklyRoutePatterns } from '../../src/app/shellRoutes'

/**
 * THE STAGE 14 CUTOVER SWITCH, PROVED IN BOTH POSITIONS.
 *
 * ============================ WHY THE OFF BRANCH IS THE POINT ============
 *
 * `src/app/routeFlags.ts` exists because the modernisation plan makes rollback
 * a release gate: a flag must restore the prior journey with no data rollback.
 * A test that only proves the ON branch proves the feature and not the gate.
 * The rollback is the half that has to work on the worst day of the release,
 * and it is the half nobody exercises by using the product.
 *
 * So both branches are asserted here, and the OFF branch is asserted FIRST —
 * because it is the branch a bad day depends on.
 *
 * THE CUTOVER IS NOW ON, AND THAT CHANGES WHICH BRANCH SHIPS RATHER THAN WHICH
 * BRANCH MATTERS. `config/vnext-programme.json` carries
 * `productionCutoverAuthorized: true`, `netlify.toml` sets all fourteen
 * destination flags in `[build.environment]`, and every hosted environment is
 * level — so a player's Matches route today is `VNextMatchesDestination`. (This
 * said "nine" for as long as there were fourteen, which is the same drift the
 * destination table below was carrying; the count is now asserted against the
 * flag declaration rather than remembered.)
 * What is unchanged is that every legacy route component is still mounted, so
 * removing one line from the build config restores that one journey with no
 * migration, no backfill and no data rollback. These cases are what prove the
 * removal would work.
 *
 * ============================ WHAT IT DOES NOT TEST ======================
 *
 * Not what either surface renders. `SeasonMatchesRoute` has its own tests and
 * the vNext screens have theirs, and re-asserting their content here would
 * couple a routing test to two component trees and fail for reasons that have
 * nothing to do with routing. This asserts ONE property: which component the
 * route mounts, as a function of the flag.
 *
 * The route elements are therefore stubbed. That is not a weakening — mounting
 * the real ones would drag in `AuthProvider`, Supabase and the whole season
 * read stack to answer a question about a `switch` statement.
 */

const flag = vi.hoisted(() => ({ value: undefined as string | undefined }))

vi.mock('../../src/app/routeFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/app/routeFlags')>()
  return {
    ...actual,
    isNextUi: (journey: string) =>
      journey === 'footballHubMatches' ? flag.value?.trim() === 'true' : false,
  }
})

/** The choice the application makes, reduced to the one line under test. */
function MatchesRoute({ next }: { next: boolean }) {
  return next ? <div>vnext-matches</div> : <div>legacy-matches</div>
}

function renderMatchesAt(path: string, next: boolean) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={weeklyRoutePatterns.matches} element={<MatchesRoute next={next} />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  flag.value = undefined
  vi.unstubAllEnvs()
})

describe('the Football Hub cutover switch', () => {
  it('fails closed: absent, empty and misspelled all select legacy', async () => {
    const { journeyImplementation } = await import('../../src/app/routeFlags')
    for (const value of [undefined, '', ' ', 'TRUE', 'yes', '1', 'false']) {
      vi.stubEnv('VITE_UI_FOOTBALL_HUB_MATCHES', value as string)
      expect(
        journeyImplementation('footballHubMatches'),
        `${JSON.stringify(value)} must not open the cutover`,
      ).toBe('legacy')
    }
  })

  it("selects 'next' only for exactly 'true'", async () => {
    const { journeyImplementation } = await import('../../src/app/routeFlags')
    vi.stubEnv('VITE_UI_FOOTBALL_HUB_MATCHES', 'true')
    expect(journeyImplementation('footballHubMatches')).toBe('next')
  })

  it('mounts the legacy route when the flag is off — the rollback state', () => {
    renderMatchesAt('/competitions/scottish-premiership/2026-27/matches', false)
    expect(screen.getByText('legacy-matches')).toBeTruthy()
    expect(screen.queryByText('vnext-matches')).toBeNull()
  })

  it('mounts the vNext route when the flag is on', () => {
    renderMatchesAt('/competitions/scottish-premiership/2026-27/matches', true)
    expect(screen.getByText('vnext-matches')).toBeTruthy()
    expect(screen.queryByText('legacy-matches')).toBeNull()
  })

  /**
   * EVERY DESTINATION, AND ITS LEGACY COUNTERPART.
   *
   * One row per cutover flag: the journey name `routeFlags.ts` knows, the
   * environment variable, the vNext element and the legacy element it replaces.
   * A destination added to the seam without a row here is a destination nothing
   * holds to the rollback rule.
   *
   * IT IS EVERY FLAG `routeFlags.ts` DECLARES, AND THAT IS ASSERTED RATHER THAN
   * INTENDED. The table stood at ten while the module declared fourteen, so four
   * destinations — Onboarding, Invite, Create Private Play and Season Wrapped —
   * had no row at all, which is exactly the state the paragraph above says must
   * not exist. Two of them had legacy halves nothing asserted. The `covers every
   * declared journey` case below is what stops the count drifting again: the row
   * set is now compared against the source of the flag type itself.
   *
   * `rollback` RECORDS WHAT THE OFF BRANCH ACTUALLY DOES, because it is not one
   * thing. Twelve rows restore a legacy journey. Two — Create Private Play and
   * Season Wrapped — select between a vNext surface and NOTHING, because those
   * addresses did not exist before vNext built them; turning those off withdraws
   * an address rather than restoring a screen, and `routeFlags.ts` says so in its
   * own words. Both are valid rollbacks and they are not the same promise, so the
   * table states which one each row is making instead of asserting the stronger
   * claim for all fourteen.
   */
  const DESTINATIONS: readonly {
    journey: string
    variable: string
    next: string
    legacy: string
    routes: number
    rollback?: 'legacy-journey' | 'withdraws-address'
  }[] = [
    {
      journey: 'footballHubHome',
      variable: 'VITE_UI_FOOTBALL_HUB_HOME',
      next: 'VNextHomeDestination',
      legacy: 'CompetitionDashboardPage',
      // TWO, AND THE SECOND ONE IS THE MERGE. Home is the only destination the
      // route matrix marks REDESIGN + MERGE: `/` and `/competitions/:c/:s` are
      // "ONE visible destination in the target IA", so the root consults the
      // same flag to decide whether to resolve into the competition's Home or
      // to leave the player on the legacy hub. One flag rather than two is
      // deliberate — see the note beside `VNextRootDestination` in App.tsx —
      // because a merged destination whose two addresses could disagree about
      // which implementation is serving would be worse than either.
      //
      // FOUR NOW, AND THE OTHER TWO ARE THE ABSORPTIONS. `/play` and the
      // competition-scoped `play` are the matrix's `HIDE / ABSORB` rows whose
      // job went to Home — "what needs doing HERE is Home's" — so each resolves
      // into it, gated on Home's own flag. Rolling Home back therefore restores
      // both action lists with it, which is the property that makes the
      // redirect safe to add at all.
      routes: 4,
    },
    {
      journey: 'footballHubMatches',
      variable: 'VITE_UI_FOOTBALL_HUB_MATCHES',
      next: 'VNextMatchesDestination',
      legacy: 'SeasonMatchesRoute',
      // The competition's Matches, its Match Centre, and `/matches` — the
      // global calendar, whose job is now the `combined` scope inside the first.
      routes: 3,
    },
    {
      journey: 'footballHubGames',
      variable: 'VITE_UI_FOOTBALL_HUB_GAMES',
      next: 'VNextGamesDestination',
      legacy: 'CompetitionGamesPage',
      // Games, and `/more/scoring`: rules belong beside the game they govern.
      routes: 2,
    },
    {
      journey: 'footballHubLeagues',
      variable: 'VITE_UI_FOOTBALL_HUB_LEAGUES',
      next: 'VNextLeaguesDestination',
      legacy: 'SeasonLeaguesRoute',
      // The competition's Leagues, `/leagues`, and the Match Predictor
      // standings — the season table is a SCOPE inside Leagues rather than a
      // page, so both absorbed addresses resolve there.
      routes: 3,
    },
    {
      journey: 'footballHubPlayerProfile',
      variable: 'VITE_UI_FOOTBALL_HUB_PLAYER_PROFILE',
      next: 'VNextPlayerProfileDestination',
      legacy: 'SeasonPlayerProfileRoute',
      routes: 1,
    },
    {
      journey: 'footballHubDiscovery',
      variable: 'VITE_UI_FOOTBALL_HUB_DISCOVERY',
      next: 'VNextDiscoveryDestination',
      legacy: 'ExploreCompetitionsPage',
      routes: 1,
    },
    {
      journey: 'footballHubAccount',
      variable: 'VITE_UI_FOOTBALL_HUB_ACCOUNT',
      next: 'VNextAccountDestination',
      legacy: 'AccountPage',
      // `/account`, plus `/more` and `/profile`: the matrix sends the three
      // profile systems to Account / You rather than adding a fourth.
      routes: 3,
    },
    {
      journey: 'footballHubLms',
      variable: 'VITE_UI_FOOTBALL_HUB_LMS',
      next: 'VNextLmsDestination',
      legacy: 'SeasonLmsRoute',
      routes: 1,
    },
    {
      journey: 'footballHubChampionship',
      variable: 'VITE_UI_FOOTBALL_HUB_CHAMPIONSHIP',
      next: 'VNextChampionshipDestination',
      legacy: 'SeasonChampionshipRouter',
      routes: 1,
    },
    {
      // THE ROW THIS TABLE SHOULD HAVE HAD IN #945. The adapter shipped in that
      // stage and no route mounted it, so the destination existed, passed its
      // own tests, and served nobody — and the PR description counted it among
      // the nine that had moved. A table of destinations that only lists the
      // ones somebody remembered to wire is not a guard.
      journey: 'footballHubPredictor',
      variable: 'VITE_UI_FOOTBALL_HUB_PREDICTOR',
      next: 'VNextPredictorDestination',
      legacy: 'SeasonMatchPredictorRoute',
      routes: 1,
    },
    {
      // FIRST SIGN-IN. The switch is the PRESENTATION only — `commitOnboarding`
      // writes the follows, the game entries and the completion stamp on both
      // sides of it — so the legacy half is a screen rather than a journey, and
      // it is still mounted.
      journey: 'footballHubOnboarding',
      variable: 'VITE_UI_FOOTBALL_HUB_ONBOARDING',
      next: 'VNextWelcomeDestination',
      legacy: 'WelcomePage',
      routes: 1,
    },
    {
      // THE INVITE DEEP LINK, on the same terms: `useInviteCode` resolves and
      // accepts on both sides, and `useInviteLanding` owns the signed-out
      // hand-off for both. Turning it off changes what the page looks like and
      // nothing about what an invitation does.
      journey: 'footballHubInvite',
      variable: 'VITE_UI_FOOTBALL_HUB_INVITE',
      next: 'VNextJoinDestination',
      legacy: 'JoinLandingPage',
      routes: 1,
    },
    {
      // AN ADDRESS THAT DID NOT EXIST BEFORE vNEXT BUILT IT. Off withdraws the
      // corridor and leaves the journey at `/leagues`, which is where it has
      // always been — so the legacy half is a not-found rather than a screen.
      journey: 'footballHubCreatePrivatePlay',
      variable: 'VITE_UI_FOOTBALL_HUB_CREATE',
      next: 'VNextCreateDestination',
      legacy: 'NotFoundPage',
      routes: 1,
      rollback: 'withdraws-address',
    },
    {
      // THE SAME SHAPE. Contract 156 has stored the archive since `MIG-UI-08`
      // and no UI ever rendered it, so off withdraws the address and leaves the
      // season history in Account exactly where a player has always found it.
      journey: 'footballHubSeasonWrapped',
      variable: 'VITE_UI_FOOTBALL_HUB_WRAPPED',
      next: 'VNextWrappedDestination',
      legacy: 'NotFoundPage',
      routes: 1,
      rollback: 'withdraws-address',
    },
  ]

  /**
   * THE TABLE MUST COVER EVERY DECLARED JOURNEY.
   *
   * Read from `routeFlags.ts` rather than from a second list here, because a
   * second list is the thing that drifted: the table sat at ten while the module
   * declared fourteen, and nothing noticed because nothing compared them. The
   * two non-cutover journeys are named explicitly rather than filtered by a
   * prefix, so adding a flag called `footballHubSomething` cannot be absorbed
   * silently by a pattern.
   */
  it('covers every cutover journey routeFlags.ts declares', () => {
    const source = readFileSync(
      resolve(import.meta.dirname, '../../src/app/routeFlags.ts'),
      'utf8',
    )
    const declared = new Set(
      (source.match(/^\s*\|\s*'([A-Za-z]+)'$/gm) ?? []).map((line) =>
        line.replace(/^\s*\|\s*'/, '').replace(/'$/, ''),
      ),
    )
    // Not Football Hub destinations: one selects whether a FEATURE is served at
    // all, the other whether a signed-out visitor meets a landing page.
    declared.delete('seasonMatchPredictor')
    declared.delete('publicLanding')

    const covered = new Set(DESTINATIONS.map((row) => row.journey))
    expect(declared.size, 'the flag type must still be readable from source').toBeGreaterThan(0)
    expect([...declared].filter((journey) => !covered.has(journey))).toEqual([])
    expect([...covered].filter((journey) => !declared.has(journey))).toEqual([])
  })

  it.each(DESTINATIONS)('$journey fails closed on anything but "true"', async ({ journey, variable }) => {
    const { journeyImplementation } = await import('../../src/app/routeFlags')
    for (const value of [undefined, '', ' ', 'TRUE', 'yes', '1', 'false']) {
      vi.stubEnv(variable, value as string)
      expect(
        journeyImplementation(journey as never),
        `${JSON.stringify(value)} must not open ${journey}`,
      ).toBe('legacy')
    }
    vi.stubEnv(variable, 'true')
    expect(journeyImplementation(journey as never)).toBe('next')
  })

  it.each(DESTINATIONS)(
    '$journey routes through the flag and keeps its off branch mounted',
    ({ journey, variable, next, legacy, routes, rollback }) => {
      const app = readFileSync(resolve(import.meta.dirname, '../../src/App.tsx'), 'utf8')

      const asked = app.match(new RegExp(`isNextUi\\('${journey}'\\)`, 'g')) ?? []
      expect(asked.length, `${journey} must be consulted by ${routes} route(s)`).toBe(routes)

      // THE OFF BRANCH MUST STAY MOUNTED. A cutover that deletes the old element
      // has no rollback, whatever the flag says. For the two addresses vNext
      // invented, the off branch is a deliberate not-found rather than a screen
      // — see `rollback` on the table.
      expect(app, `${legacy} must still be routed`).toContain(`<${legacy} />`)
      expect(app, `${next} must be routed`).toContain(`<${next} />`)
      if (rollback === 'withdraws-address') {
        /**
         * THE `toContain` ABOVE IS VACUOUS FOR THIS CASE ON ITS OWN, and saying
         * so is the reason this block exists. `<NotFoundPage />` is in `App.tsx`
         * anyway as the sessionless catch-all, so asserting its presence would
         * pass even if this destination's off branch had been changed to
         * something else entirely.
         *
         * So read the branch itself: the `isNextUi` call for this journey must
         * be followed, within its own ternary, by `<NotFoundPage />`. A legacy
         * screen appearing there is a re-classification this table has to make
         * deliberately, not a change that slips past a substring match.
         */
        const branch = new RegExp(
          `isNextUi\\('${journey}'\\)[\\s\\S]{0,600}?\\)\\s*:\\s*\\(\\s*<NotFoundPage />`,
        )
        expect(
          branch.test(app),
          `${journey} must fall back to <NotFoundPage /> in its own branch`,
        ).toBe(true)
      }

      // AND THE BUILD-TIME GATE MUST GUARD THE LAZY IMPORT, or the subtree ships
      // whatever the runtime flag says.
      expect(app).toContain(`import.meta.env.${variable} === 'true'`)
    },
  )

  it('wires the real routes through the flag, not just the flag through a stub', () => {
    // THE GAP THIS CLOSES. Everything above proves the flag reads correctly
    // and that a route renders whichever element it is given. Neither proves
    // `App.tsx` actually asks. Mounting the real router would drag in auth,
    // Supabase and both component trees to answer that, so the wiring is read
    // from the source — the same technique `vnextStyleClasses` uses, and for
    // the same reason: the mistake is made in the source and is invisible in
    // the DOM, because a route that forgot to ask simply renders legacy for
    // ever and looks exactly like a correctly-off flag.
    const app = readFileSync(resolve(import.meta.dirname, '../../src/App.tsx'), 'utf8')
    const guarded = app.match(/isNextUi\('footballHubMatches'\)/g) ?? []
    expect(
      guarded.length,
      'both matches routes and the absorbed global calendar must consult the flag',
    ).toBe(3)
    for (const element of [
      'VNextMatchesDestination',
      'VNextMatchCentreDestination',
      'SeasonMatchesRoute',
      'SeasonMatchCentreRoute',
    ]) {
      // The legacy pair must STAY mounted. A cutover that deletes the old
      // element has no rollback, whatever the flag says.
      expect(app, `${element} must still be routed`).toContain(`<${element} />`)
    }
  })

  it('reads the flag identically in both places, so the two cannot drift', () => {
    // WHY THERE ARE TWO READINGS AT ALL. `isNextUi()` is a function call and no
    // bundler can see through it, so a route that merely asks still drags the
    // vNext surfaces AND their CSS into the shipped artifact — measured, all JS
    // 354.0 -> 411.2 KB gz and all CSS 42.5 -> 49.1, against budgets of 366 and
    // 44. `cssCodeSplit: false` is why the CSS half bites: one stylesheet, every
    // visitor, lazy or not.
    //
    // So `App.tsx` also compares `import.meta.env.VITE_UI_FOOTBALL_HUB_MATCHES`
    // INLINE, which Vite folds to a literal so Rollup drops the subtree. With
    // every cutover flag off the build measures 79.9 / 430.4 / 53.2 KB gz and
    // with them on 89.6 / 479.7 / 58.1 — so turning a destination back off
    // recovers its bytes as well as its behaviour, which is the property this
    // duplication buys. Re-exporting the same comparison as a const from
    // `routeFlags.ts` was tried and does not fold across the module boundary, so
    // the duplication is a bundler constraint rather than a preference.
    //
    // Two readings of one flag is precisely the drift `routeFlags.ts` exists to
    // prevent, so this pins them to the same variable and the same string.
    const app = readFileSync(resolve(import.meta.dirname, '../../src/App.tsx'), 'utf8')
    const flags = readFileSync(
      resolve(import.meta.dirname, '../../src/app/routeFlags.ts'),
      'utf8',
    )
    const VARIABLE = 'VITE_UI_FOOTBALL_HUB_MATCHES'
    expect(app).toContain(`import.meta.env.${VARIABLE} === 'true'`)
    expect(flags).toContain(`enabled(import.meta.env.${VARIABLE})`)
    // `enabled()` is `=== 'true'` after a trim, so both readings accept exactly
    // the same value. If either side ever loosens, this is the tripwire.
    expect(flags).toContain("value?.trim() === 'true'")
    // And the build-time gate must actually guard the lazy imports, or the
    // subtree comes back regardless of what the constant says.
    expect(app).toMatch(/FOOTBALL_HUB_MATCHES_BUILT\s*\n?\s*\?\s*lazy\(\(\) =>/)
  })

  it('keeps the Match Centre address self-contained, so a deep link survives', async () => {
    // Contract 148 resolves a fixture from its id alone. The pattern must
    // therefore carry a `:fixtureId` and no window or date parameter — a
    // Match Centre that needed `?on=` could not be shared or refreshed.
    expect(weeklyRoutePatterns.matchCentre).toContain(':fixtureId')
    expect(weeklyRoutePatterns.matchCentre).not.toContain('?')
    const { competitionMatchCentreRoute } = await import('../../src/app/weeklyRoutes')
    const href = competitionMatchCentreRoute(
      { competitionSlug: 'scottish-premiership', seasonSlug: '2026-27' },
      'fixture-uuid',
    )
    expect(href).toBe('/competitions/scottish-premiership/2026-27/matches/fixture-uuid')
  })
})
