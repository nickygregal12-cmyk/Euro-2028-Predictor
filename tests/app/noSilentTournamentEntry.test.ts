import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { reachableFrom, fromRoot } from './importGraph'

/**
 * Looking at a page must not enter you into a competition.
 *
 * WHAT THIS EXISTS FOR. `PredictionsProvider` called `getOrCreateEntry`, whose
 * UPSERT into `entries` fires the contract-66 membership trigger. So merely
 * rendering a surface that mounted the provider created a Euro 2028 entry for
 * the visitor and made them a member of its competition. That was invisible
 * while every signed-in route was a Euro route — everyone there had entered on
 * purpose. It became a live `EURO-001` violation with a STORED consequence the
 * moment the platform went multi-competition: More → Profile is two taps from a
 * Scottish Premiership player's Hub, and tapping it enrolled them in a
 * tournament they had never heard of.
 *
 * The provider now reads. This keeps it reading, because the difference between
 * `fetchMyEntry` and `getOrCreateEntry` is one identifier and no reviewer would
 * see it in a diff about something else.
 *
 * `getOrCreateEntry` is deliberately still exported and still tested. The Euro
 * journeys are parked, not deleted, and when they return they will need a way
 * to enter — as an explicit act, from a join surface, which is exactly the
 * thing this stops happening by accident.
 */

const repositoryRoot = process.cwd()

const CREATOR = 'getOrCreateEntry'
/** A CALL, not the word: this file and the provider both discuss it in prose. */
const CALL = new RegExp(`\\b${CREATOR}\\s*\\(`)

/**
 * The one production-reachable caller, allowed by name and by reason.
 *
 * Accepting a private-league invitation IS the explicit opt-in — the visitor
 * has read the league preview and pressed Join — and contract 66 refuses league
 * membership without the game membership that entry creates. That is an act,
 * which is precisely what this suite protects; what it forbids is the same call
 * happening because a component rendered.
 *
 * The allowance is narrow: the call must sit inside the join HANDLER, not an
 * effect. A file cannot join this list by being added to it — the assertion
 * below still has to pass.
 */
const EXPLICIT_OPT_IN = 'src/features/leagues/JoinLandingPage.tsx'

describe('entering a competition is an act, not a side effect', () => {
  it('is not called by the predictions provider', () => {
    const provider = readFileSync(
      resolve(repositoryRoot, 'src/app/providers/PredictionsProvider.tsx'),
      'utf8',
    )
    expect(
      CALL.test(provider),
      'PredictionsProvider calls getOrCreateEntry again — rendering a page ' +
        'would create an entry and a competition membership for the visitor',
    ).toBe(false)
    expect(provider, 'the provider no longer reads the entry at all').toContain('fetchMyEntry')
  })

  it('is called by nothing the production entry can reach', () => {
    // Stated over the graph rather than over one file, because the next caller
    // will not be in the file this defect was found in. `src/dev/` is stopped
    // at for the reason recorded in the parked-Euro boundary: those harnesses
    // are behind `import.meta.env.DEV` and Vite strips them.
    const graph = reachableFrom(resolve(repositoryRoot, 'src/main.tsx'), {
      stopAt: ['/src/dev/'],
    })

    const callers = [...graph].filter((file) => {
      if (file.endsWith('services/supabase/predictions.ts')) return false
      if (fromRoot(file) === EXPLICIT_OPT_IN) return false
      return CALL.test(readFileSync(file, 'utf8'))
    })

    expect(
      callers.map(fromRoot),
      'these production-reachable modules can create a tournament entry',
    ).toEqual([])
  })

  it('creates one only from a handler the visitor pressed', () => {
    // The allowance is for an ACT. If the call ever moves into an effect it
    // becomes the render-time enrolment this suite exists to stop, in the one
    // file permitted to make it.
    const source = readFileSync(resolve(repositoryRoot, EXPLICIT_OPT_IN), 'utf8')
    const handlerAt = source.indexOf('async function join()')
    const callAt = source.search(CALL)

    expect(handlerAt, 'the join handler was renamed; re-check where the call sits').toBeGreaterThan(
      -1,
    )
    expect(
      callAt,
      'the entry creation moved out of the join handler in JoinLandingPage',
    ).toBeGreaterThan(handlerAt)
    expect(source.slice(0, handlerAt)).not.toMatch(CALL)
  })

  it('still exists, because a parked journey will need it back', () => {
    const service = readFileSync(
      resolve(repositoryRoot, 'src/services/supabase/predictions.ts'),
      'utf8',
    )
    expect(service).toContain(`export async function ${CREATOR}`)
    expect(service).toContain('export async function fetchMyEntry')
  })

  it('reads with maybeSingle, so no entry is an answer rather than an error', () => {
    // `single()` raises on zero rows, which would turn the ordinary state of a
    // domestic-only player into an error screen on their own profile.
    const service = readFileSync(
      resolve(repositoryRoot, 'src/services/supabase/predictions.ts'),
      'utf8',
    )
    const read = service.slice(
      service.indexOf('export async function fetchMyEntry'),
      service.indexOf(`export async function ${CREATOR}`),
    )
    expect(read).toContain('maybeSingle')
    expect(read).not.toContain('upsert')
  })
})
