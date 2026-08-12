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

/**
 * Tournament surfaces that format their own instants, and are DEBT rather than
 * exemptions. Kept apart from `ALLOWED` so the difference is visible.
 *
 * WHERE THEY CAME FROM. Un-parking the Euro journeys on 11 August 2026 — the
 * route half of `EURO-001` — put the tournament's own pages into the shipping
 * graph for the first time since `src/shared/time/kickoff.ts` became the
 * authority under `UI-F02`. They predate it. Nothing about them changed; what
 * changed is that this guard can now see them.
 *
 * WHY THEY ARE NOT FIXED IN THE SAME CHANGE. Each is a kickoff or a deadline
 * shown to a player, so converting it moves what a player reads on a tournament
 * surface, and the only evidence for those surfaces is the browser suite — which
 * needs a seeded database and could not be run in the session that un-parked
 * them. Rewriting five presentation paths blind, inside a change whose whole
 * purpose is to prove the journeys still work, would make the browser run
 * unable to tell a routing failure from a formatting one.
 *
 * They are recorded in `docs/quality/current-status.md` and belong to the
 * parked tournament programme's return, not to this list growing quietly.
 */
const TOURNAMENT_PARKED: Record<string, string> = {
  'src/domain/tournament/matchCentrePageModel.ts': 'tournament Match Centre day and kickoff',
  'src/features/games/CupPage.tsx': 'Predictor Cup tie kickoff',
  'src/features/games/GamesPage.tsx': 'bonus-game deadlines',
  'src/features/games/LmsPage.tsx': 'Last Man Standing round deadline',
  'src/features/predict/ReviewWorkspacePage.tsx': 'entry review lock instant',
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
      if (file === AUTHORITY || file in ALLOWED || file in TOURNAMENT_PARKED) return false
      return INSTANT_FORMATTERS.test(readFileSync(resolve(repositoryRoot, file), 'utf8'))
    })

    expect(
      offenders,
      'Format kickoffs, deadlines and match days through src/shared/time/kickoff.ts. ' +
        'If the value genuinely is not one of those, add the module to ALLOWED with the reason.',
    ).toEqual([])
  })

  it('keeps the tournament debt list honest, and shrinking', () => {
    // An entry that has been converted must LEAVE this list rather than sit in
    // it for ever looking like an approved exemption. Each is asserted to still
    // format an instant; when one stops, this fails and the row comes out.
    const stale = Object.keys(TOURNAMENT_PARKED).filter(
      (file) => !INSTANT_FORMATTERS.test(readFileSync(resolve(repositoryRoot, file), 'utf8')),
    )
    expect(
      stale,
      'these modules no longer format an instant — remove them from TOURNAMENT_PARKED',
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
