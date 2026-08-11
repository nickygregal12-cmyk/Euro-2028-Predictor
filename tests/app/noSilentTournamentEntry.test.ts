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
 * THERE IS NO PRODUCTION-REACHABLE CALLER LEFT, and that is a strengthening
 * rather than a gap.
 *
 * `JoinLandingPage` used to be allowed one, by name and by reason: accepting a
 * private-league invitation was an explicit opt-in, and contract 66 refuses
 * league membership without the game membership an entry creates. The narrow
 * allowance was for the CALL to sit inside the join handler and never in an
 * effect.
 *
 * Contract 155 removed the need for it. `resolve_invite_code` reports
 * `requires_game_entry`, so an invitee whose game membership is missing is TOLD
 * which game to join, instead of being entered into one as a side effect of
 * pressing Join on a league invite. Creating a tournament membership on the way
 * to somewhere else is the same class of invisible enrolment this suite exists
 * to stop — it was merely one press further along than the render-time version.
 *
 * The list is therefore empty, and the assertion below is now unconditional.
 */
const EXPLICIT_OPT_IN: readonly string[] = []

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
      if (EXPLICIT_OPT_IN.includes(fromRoot(file))) return false
      return CALL.test(readFileSync(file, 'utf8'))
    })

    expect(
      callers.map(fromRoot),
      'these production-reachable modules can create a tournament entry',
    ).toEqual([])
  })

  it('is not created anywhere on the invite path at all', () => {
    // The narrow handler allowance is gone with the reason for it. An invitee
    // missing the underlying game membership is told to join that game, which
    // is an act they take in the game's own surface -- not one taken for them
    // while they were accepting a league invitation.
    for (const path of [
      'src/features/leagues/JoinLandingPage.tsx',
      'src/features/leagues/JoinLeagueModal.tsx',
      'src/features/leagues/useInviteCode.ts',
    ]) {
      expect(
        CALL.test(readFileSync(resolve(repositoryRoot, path), 'utf8')),
        `${path} creates a tournament entry on the invite path`,
      ).toBe(false)
    }
  })
})
