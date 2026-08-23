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
  /**
   * THE vNEXT PRESENTATION LANE, AND WHY IT IS TWO IMPLEMENTATIONS OF ONE RULE.
   *
   * `/about` and the public landing page's product preview put vNext surfaces
   * in the shipping graph, so this guard now sees the lane's own formatter. It
   * is a real second implementation and pretending otherwise would be worse
   * than admitting it.
   *
   * IT CANNOT DELEGATE TO `kickoff.ts` WITHOUT LOSING THE PROPERTY IT EXISTS
   * FOR, and that was checked rather than assumed. Two differences, both
   * load-bearing:
   *
   *   • `kickoff.ts` always formats in the VIEWER's locale (`toLocaleTimeString`
   *     with `undefined`), which is right for the product and fatal for a
   *     workshop: a story would be a different picture on two machines and a
   *     screenshot could not be compared with yesterday's. vNext takes a
   *     `VNextPresentationZone` so production passes the reader's zone and a
   *     story passes the pinned one.
   *   • `kickoff.ts` constructs a formatter per call. A vNext fixture list
   *     formats once per row; the lane caches four `Intl.DateTimeFormat`
   *     instances per zone.
   *
   * SO THE RULE IS SHARED AND THE CODE IS NOT, and the sharing is enforced
   * rather than described: `tests/vnext/vnextViewerZone.test.tsx` asserts that
   * the two produce the SAME string for the same instant in the same zone, in
   * both directions of a zone change. If they ever drift, that fails — which is
   * the thing this guard is actually protecting.
   */
  'src/vnext/foundations/format.ts':
    'the vNext lane\u2019s formatter; obeys kickoff.ts\u2019s rules and is pinned to them by test',
  // A deterministic WORLD, not a surface. It builds the fixture data a story and
  // a screenshot render, in a pinned zone on purpose — the file says so at
  // length beside the formatter. Nothing a player sees is formatted here.
  'src/vnext/fixtures/matches/scenarios.ts':
    'builds deterministic review worlds in a pinned zone; formats nothing a player sees',
  // The private Lab's OPERATIONAL clock, and the distinction is checkable. The
  // one genuine kickoff on this page goes through `formatKickoffWithDay` above;
  // what remains formats when a job last ran, when a model was trained and the
  // date a model was trained through. None of those is a kickoff, a deadline or
  // a match day, and none is player-facing — this surface is administrator-only.
  'src/features/admin/AiLabPage.tsx':
    'formats operational instants (job runs, training timestamps); its one kickoff uses the authority',
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

  /**
   * The assertion above asks "who FORMATS an instant". It cannot see the other
   * half of the same rule — who fails to.
   *
   * IT MISSED A REAL DEFECT, WHICH IS WHY IT EXISTS. `SeasonMatchPredictorPage`
   * shipped passing `fixture.kickoffAt` straight into `ClubMatchCard`'s
   * `kickoff` label, so the raw ISO timestamp rendered in every card's eyebrow
   * on the Match Predictor. The page called no formatter, so it was not an
   * offender by the rule above; it was an offender by the rule the direction
   * actually states — "no raw timestamp ever reaches a player".
   *
   * So: a value whose NAME says it is an instant may not be handed to a JSX
   * prop or interpolated into text unless a formatter is in the expression.
   * Naming is the only signal available without types at this layer, and the
   * repository's naming is consistent — `kickoffAt`, `locksAt`, `settledAt`.
   * A value that is genuinely not an instant should not be named as one.
   */
  const INSTANT_NAMED = String.raw`(?:kickoff|starts|locks|lock|opens|closes|settled|created|updated|played|reviewed|fetched|changed|confirmed|submitted)At`

  /** `foo={bar.kickoffAt}` and `{bar.kickoffAt}` in text, formatter-free. */
  const RAW_INSTANT_USES = [
    // A JSX attribute whose whole value is an instant-named expression.
    new RegExp(String.raw`\w+=\{[\w.?\[\]]*\b${INSTANT_NAMED}\b\}`, 'g'),
    // The same value interpolated as visible text or into a template string.
    new RegExp(String.raw`\{[\w.?\[\]]*\b${INSTANT_NAMED}\b\}(?!\s*[),;])`, 'g'),
  ]

  /**
   * Props that carry an instant to something that is not a player-visible
   * label: a `key`, a machine-readable `dateTime`, a sort or compare input, a
   * value handed onward to another model.
   */
  const NOT_A_LABEL = /^(key|dateTime|value|id|data-[\w-]+|aria-valuetext)=/

  it('does not hand an unformatted instant to a component or to text', () => {
    const offenders: string[] = []

    for (const file of productionModules()) {
      if (file === AUTHORITY || !file.endsWith('.tsx')) continue
      const lines = readFileSync(resolve(repositoryRoot, file), 'utf8').split('\n')

      lines.forEach((line, index) => {
        for (const pattern of RAW_INSTANT_USES) {
          for (const match of line.matchAll(pattern)) {
            const text = match[0]
            if (NOT_A_LABEL.test(text)) continue
            // A formatter anywhere in the expression is the whole point of the
            // rule being satisfied.
            if (/format|Format|label|Label/.test(text)) continue
            offenders.push(`${file}:${index + 1}  ${text.trim()}`)
          }
        }
      })
    }

    expect(
      offenders,
      'An instant reached a rendered value without passing through ' +
        'src/shared/time/kickoff.ts. Format it, or — if it is genuinely not ' +
        'shown to a player — give it a name that does not claim to be an instant.',
    ).toEqual([])
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
