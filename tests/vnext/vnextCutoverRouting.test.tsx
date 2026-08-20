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
 * because that is the state this change actually ships in.
 * `productionCutoverAuthorized` is `false` in `config/vnext-programme.json`,
 * `VITE_UI_FOOTBALL_HUB_MATCHES` is absent from every deployed environment,
 * and `enabled()` fails closed on absent. A player's Matches route today is
 * the same `SeasonMatchesRoute` it was before this file existed.
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

  it('mounts the legacy route when the flag is off — the shipped state', () => {
    renderMatchesAt('/competitions/scottish-premiership/2026-27/matches', false)
    expect(screen.getByText('legacy-matches')).toBeTruthy()
    expect(screen.queryByText('vnext-matches')).toBeNull()
  })

  it('mounts the vNext route when the flag is on', () => {
    renderMatchesAt('/competitions/scottish-premiership/2026-27/matches', true)
    expect(screen.getByText('vnext-matches')).toBeTruthy()
    expect(screen.queryByText('legacy-matches')).toBeNull()
  })

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
    expect(guarded.length, 'both matches routes must consult the flag').toBe(2)
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
    // the flag off the bundle is byte-identical to `main`. Re-exporting the same
    // comparison as a const from `routeFlags.ts` was tried and does not fold
    // across the module boundary, so the duplication is a bundler constraint.
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
