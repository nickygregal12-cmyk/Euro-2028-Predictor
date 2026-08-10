import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fromRoot, reachableFrom } from './importGraph'

/**
 * One kickoff/date presentation authority for the shipping product.
 *
 * WHY THIS GUARD EXISTS. The owner's 10 August 2026 UI direction requires that
 * no raw timestamp reaches a player and that kickoffs resolve in the viewer's
 * own device zone — and, explicitly, that ONE shared formatting helper is used
 * across the Hub, Competition Overview, Matches, Match Predictor, LMS,
 * Championship, Match Centre, league activity and prediction history, "to
 * prevent date formatting drift". A comment saying so does not fail. This does.
 *
 * The drift it is guarding against is not hypothetical: before the shared
 * authority landed there were five separate local `formatInstant` copies in the
 * repository and a sixth formatter inside the fixture list model, and two of
 * them disagreed about whether a kickoff belongs to the competition's zone or
 * the reader's.
 *
 * IT IS SCOPED TO WHAT SHIPS. The graph is walked from the production entry, so
 * the parked Euro journeys, the unreachable premium prototype and the DEV
 * harnesses are all out of scope by construction rather than by an exclusion
 * list somebody has to maintain. Those trees keep their own formatters; they
 * are not what a player sees.
 */

const repositoryRoot = process.cwd()

/** The shared authority itself, and the only place these calls are allowed. */
const AUTHORITY = 'src/shared/time/kickoff.ts'

/**
 * `Intl`-backed instant formatting. `toLocaleString` on a NUMBER is a different
 * thing entirely — thousands separators — so the match is anchored to the date
 * methods and to `Intl.DateTimeFormat`, and the number case is asserted below
 * to stay allowed.
 */
const INSTANT_FORMATTERS = /\.toLocaleDateString\(|\.toLocaleTimeString\(|new Intl\.DateTimeFormat\(/

/**
 * Modules that legitimately format something that is NOT a kickoff, a deadline
 * or a match day, each with the reason it is not drift.
 */
const ALLOWED: Record<string, string> = {
  // Date-only tournament helpers ("14 Jun", "2 days"): no instant, no zone
  // question, and the weekly product does not call them for a kickoff.
  'src/app/time.ts':
    'date-only helpers over a YYYY-MM-DD calendar date, with no instant and no zone to get wrong',
  // An operator's audit trail, not a player's fixture. It prints when a
  // provider queue item was recorded, in the operator's own zone, and it is
  // behind the admin routes.
  'src/features/admin/ProviderReviewPanel.tsx':
    'an administrator-only provenance timestamp, never a kickoff shown to a player',
  'src/features/admin/EuroPublicationPage.tsx':
    'an administrator-only publication-history timestamp, never a kickoff shown to a player',
  'src/features/admin/AdminResultsPage.tsx':
    'an administrator-only confirmation/correction timestamp in the Results Centre',
  'src/features/admin/AdminThirdPlaceResolutionPanel.tsx':
    'an administrator-only resolution timestamp',
  // Not presentation at all. Both derive a `YYYY-MM-DD` KEY for "which day of
  // the competition is this", and validate a zone identifier — questions the
  // competition's own calendar owns and the viewer-zone rule does not touch.
  'src/domain/competition/context.ts':
    'derives a competition-day key and validates a zone identifier; renders nothing',
  'src/features/shared/tournamentCompetitionContext.ts':
    'derives a competition-day key and validates a zone identifier; renders nothing',
}

function productionModules(): string[] {
  const graph = reachableFrom(resolve(repositoryRoot, 'src/main.tsx'), {
    // The component gallery is behind `import.meta.env.DEV` and never ships;
    // its pinned zones are deliberate determinism for screenshots.
    stopAt: ['src/dev/'],
  })
  return [...graph]
    .map(fromRoot)
    // `stopAt` stops the walk from following THROUGH the harnesses; the entry
    // file itself is still reported, so it is dropped here too.
    .filter((file) => file.startsWith('src/') && !file.startsWith('src/dev/'))
    .sort()
}

describe('kickoff and date presentation has one authority', () => {
  it('is the only module in the shipping graph that formats an instant', () => {
    const offenders = productionModules().filter((file) => {
      if (file === AUTHORITY || file in ALLOWED) return false
      return INSTANT_FORMATTERS.test(readFileSync(resolve(repositoryRoot, file), 'utf8'))
    })

    expect(
      offenders,
      'Format kickoffs, deadlines and match days through src/shared/time/kickoff.ts. ' +
        'If the value genuinely is not one of those, add the module to ALLOWED with the reason.',
    ).toEqual([])
  })

  it('still reaches the modules it is meant to be guarding', () => {
    // Guard the guard. If the walk stopped returning the weekly surfaces, the
    // assertion above would pass by finding nothing at all.
    const modules = productionModules()
    for (const expected of [
      'src/features/season/fixtureListModel.ts',
      'src/features/season/SeasonMatchesPage.tsx',
      'src/features/hub/competitionWeekModel.ts',
      AUTHORITY,
    ]) {
      expect(modules).toContain(expected)
    }
  })

  it('leaves number formatting alone', () => {
    // `toLocaleString` on a number is thousands separators, not a date, and the
    // share model uses it correctly. A pattern that caught it would push the
    // next author into hand-rolling one.
    const share = readFileSync(resolve(repositoryRoot, 'src/features/share/shareModel.ts'), 'utf8')
    expect(share).toContain('.toLocaleString()')
    expect(INSTANT_FORMATTERS.test(share)).toBe(false)
  })
})
