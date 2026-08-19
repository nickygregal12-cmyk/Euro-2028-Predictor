import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import {
  VNextPresentationZoneProvider,
  WORKSHOP_PRESENTATION_ZONE,
  type VNextPresentationZone,
} from '../../src/vnext/foundations/presentationZone'
import {
  formatDayHeading,
  formatDayKey,
  formatKickoffLabel,
  formatTime,
} from '../../src/vnext/foundations/format'
import {
  formatKickoffTime,
  formatMatchDay,
  matchDayKey,
} from '../../src/shared/time/kickoff'
import { FixtureTicker } from '../../src/vnext/home/FixtureTicker'
import { LmsPickList } from '../../src/vnext/lms/LmsPickList'
import type { Match } from '../../src/vnext/models/football'
import type { LmsFixtureChoice } from '../../src/vnext/models/lms'
import { workshopHomeModel } from '../../src/vnext/fixtures'
import { at } from '../support/indexed'

/**
 * ONE PRODUCT, ONE TIME ZONE RULE.
 *
 * ============================ THE DEFECT ================================
 *
 * `src/shared/time/kickoff.ts` decides this for the whole product in one
 * sentence — the viewer's own device zone — and records that the decision
 * reversed an earlier one on purpose. Matches obeyed it because its adapter
 * formats through that module. Home, the Match Predictor, Last Man Standing and
 * the Championship did not: they call `foundations/format.ts` at render, and
 * that module pinned `en-GB` / `Europe/London`.
 *
 * So the same instant could print `17:45` on Home and `18:45` on Matches for
 * one reader, and a late kickoff could sit under different day headings on two
 * pages of one product. That is a cutover defect: the pin was correct while the
 * lane was screenshots and stops being correct the moment the lane is the
 * product.
 *
 * ============================ WHAT THESE CASES HOLD ======================
 *
 * The fix is a default plus a boundary, and a default is only as good as the
 * thing that proves the boundary is actually there. So:
 *
 *   * the formatters MOVE with the zone they are given, and two zones disagree;
 *   * `format.ts` and `kickoff.ts` AGREE for one instant in one zone, so Home
 *     and Matches cannot print different times for one kickoff;
 *   * the day key and the printed time move TOGETHER across midnight, which is
 *     the failure `kickoff.ts` names in terms;
 *   * every connected screen is inside `VNextConnectedShell`, so the workshop
 *     default cannot reach a reader;
 *   * and nothing that decides a lock, an editability or a state reads a
 *     formatter, because presentation is never a rule.
 */

const BERLIN: VNextPresentationZone = { locale: 'en-GB', timeZone: 'Europe/Berlin' }
const AUCKLAND: VNextPresentationZone = { locale: 'en-GB', timeZone: 'Pacific/Auckland' }

/** 21:45 UTC on 22 August 2026 — 22:45 in London, and already the 23rd in Auckland. */
const LATE_KICKOFF = '2026-08-22T21:45:00.000Z'
/** 09:00 UTC the same day — 10:00 in London, and 21:00 the evening before in Auckland. */
const NOW = '2026-08-22T09:00:00.000Z'

function renderIn(zone: VNextPresentationZone, node: React.ReactElement) {
  return render(
    <VNextRoot>
      <VNextPresentationZoneProvider zone={zone}>{node}</VNextPresentationZoneProvider>
    </VNextRoot>,
  )
}

describe('a vNext time is printed in the zone it was rendered inside', () => {
  it('gives two readers two different clock faces for one instant', () => {
    const london = formatTime(LATE_KICKOFF, WORKSHOP_PRESENTATION_ZONE)
    const berlin = formatTime(LATE_KICKOFF, BERLIN)

    expect(london).toBe('22:45')
    expect(berlin).toBe('23:45')
    expect(london).not.toBe(berlin)
  })

  it('defaults to the workshop pin, so a story and a render test do not move', () => {
    // The default is what keeps Storybook, the visual matrix and 7,000 render
    // assertions deterministic. It is deliberate, and the boundary case below is
    // what stops it reaching a reader.
    expect(formatTime(LATE_KICKOFF)).toBe(formatTime(LATE_KICKOFF, WORKSHOP_PRESENTATION_ZONE))
    expect(formatDayKey(LATE_KICKOFF)).toBe('2026-08-22')
  })

  it('cannot disagree with the Matches authority about one instant', () => {
    // Home formats through `format.ts`; Matches formats through `kickoff.ts`.
    // For one instant in one zone the two MUST agree, or the product prints two
    // different times for one kickoff depending on which page you are on.
    for (const zone of [WORKSHOP_PRESENTATION_ZONE, BERLIN, AUCKLAND]) {
      expect(formatTime(LATE_KICKOFF, zone)).toBe(
        formatKickoffTime(LATE_KICKOFF, zone.timeZone),
      )
      expect(formatDayKey(LATE_KICKOFF, zone)).toBe(
        matchDayKey(LATE_KICKOFF, zone.timeZone),
      )
    }
  })

  it('moves the day heading and the printed time together across midnight', () => {
    // 21:45 UTC is the 22nd in London and the 23rd in Auckland. A product that
    // grouped by one zone and printed in another would show a reader in
    // Auckland "Sat 22 August" with "09:45" under it, which is neither true.
    expect(formatDayKey(LATE_KICKOFF, WORKSHOP_PRESENTATION_ZONE)).toBe('2026-08-22')
    expect(formatDayKey(LATE_KICKOFF, AUCKLAND)).toBe('2026-08-23')

    expect(formatDayHeading(LATE_KICKOFF, WORKSHOP_PRESENTATION_ZONE)).toContain('22')
    expect(formatDayHeading(LATE_KICKOFF, AUCKLAND)).toContain('23')

    // And the same instant, through the product-wide authority, agrees.
    expect(formatMatchDay(LATE_KICKOFF, 'Pacific/Auckland')).toContain('23')
  })

  it('moves "Today" and "Tomorrow" with the zone as well as the clock', () => {
    // The relative word is a calendar-day comparison, so it has to resolve in
    // the reader's zone too. In Auckland the kickoff has already crossed into
    // tomorrow while London still calls it today.
    expect(formatKickoffLabel(LATE_KICKOFF, NOW, WORKSHOP_PRESENTATION_ZONE)).toBe('Today 22:45')
    expect(formatKickoffLabel(LATE_KICKOFF, NOW, AUCKLAND)).toBe('Tomorrow 09:45')
  })
})

describe('a rendered vNext surface takes its zone from the tree', () => {
  it('prints a fixture ticker kickoff in the supplied zone', () => {
    const matches: readonly Match[] = workshopHomeModel.upcomingMatches
    expect(matches.length).toBeGreaterThan(0)
    const kickoff = at(matches, 0).kickoff

    const london = renderIn(
      WORKSHOP_PRESENTATION_ZONE,
      <FixtureTicker matches={matches} now={workshopHomeModel.generatedAt} />,
    )
    const londonText = london.container.textContent ?? ''
    london.unmount()

    const auckland = renderIn(
      AUCKLAND,
      <FixtureTicker matches={matches} now={workshopHomeModel.generatedAt} />,
    )
    const aucklandText = auckland.container.textContent ?? ''

    expect(londonText).toContain(formatTime(kickoff, WORKSHOP_PRESENTATION_ZONE))
    expect(aucklandText).toContain(formatTime(kickoff, AUCKLAND))
    expect(londonText).not.toBe(aucklandText)
  })

  it('prints a Last Man Standing kick-off in the supplied zone', () => {
    const choices: readonly LmsFixtureChoice[] = [
      {
        key: 'fixture-1',
        kickoffAt: LATE_KICKOFF,
        home: {
          key: 'home-1',
          name: 'Northbridge United',
          action: { kind: 'pick', teamId: 'team-a' },
        },
        away: {
          key: 'away-1',
          name: 'Harbour City',
          action: { kind: 'pick', teamId: 'team-b' },
        },
      },
    ]

    const view = renderIn(BERLIN, <LmsPickList choices={choices} onPick={() => {}} />)
    expect(screen.getByText('23:45')).toBeTruthy()
    view.unmount()

    renderIn(WORKSHOP_PRESENTATION_ZONE, <LmsPickList choices={choices} onPick={() => {}} />)
    expect(screen.getByText('22:45')).toBeTruthy()
  })
})

const integrationRoot = resolve(process.cwd(), 'src/vnext/integration')

function screenFiles(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...screenFiles(path))
    else if (/Screen\.tsx$/.test(entry)) out.push(path)
  }
  return out
}

describe('the workshop pin cannot reach a reader', () => {
  const screens = screenFiles(integrationRoot)

  it('finds the connected screens, so the case is not vacuous', () => {
    expect(screens.length).toBeGreaterThanOrEqual(10)
  })

  it('wraps every connected screen in the viewer zone', () => {
    // A screen that reached for `VNextShellProvider` directly would render with
    // the workshop's pinned Europe/London for a real reader — and would look
    // completely correct in every test, because the test machine is pinned too.
    const offenders = screens.filter((file) => {
      const source = readFileSync(file, 'utf8')
      // A screen that builds a shell model is a page inside the application and
      // must carry the reader's zone. `VNextOnboardingScreen` builds none — it
      // is the flow BEFORE there is a competition to be inside, it renders no
      // instant, and giving it a shell it has no model for would be inventing
      // navigation rather than fixing a zone.
      if (!source.includes('buildShellModel')) return false
      return source.includes('VNextShellProvider') || !source.includes('VNextConnectedShell')
    })

    expect(
      offenders.map((file) => file.replace(`${process.cwd()}/`, '')),
      'a connected vNext screen is not inside VNextConnectedShell — it will ' +
        'print Europe/London to every reader in the world',
    ).toEqual([])
  })

  it('keeps the viewer zone out of the presentation lane', () => {
    // `VNextViewerZoneProvider` reads the platform. A presentation component
    // that mounted it would make its own stories non-deterministic, which is
    // the property the default exists to protect.
    const presentation = readdirSync(resolve(process.cwd(), 'src/vnext'), {
      withFileTypes: true,
    })
      .filter((entry) => entry.isDirectory() && entry.name !== 'integration')
      .flatMap((entry) => screenFilesAll(resolve(process.cwd(), 'src/vnext', entry.name)))

    const offenders = presentation.filter((file) => {
      if (file.endsWith('foundations/presentationZone.tsx')) return false
      const source = readFileSync(file, 'utf8')
      // Rendering it or importing it, not merely naming it in a docblock — the
      // modules that explain the boundary are allowed to say what it is called.
      return source.includes('<VNextViewerZoneProvider') || /import[^\n]*VNextViewerZoneProvider/.test(source)
    })

    expect(offenders.map((file) => file.replace(`${process.cwd()}/`, ''))).toEqual([])
  })
})

function screenFilesAll(directory: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) out.push(...screenFilesAll(path))
    else if (/\.tsx?$/.test(entry)) out.push(path)
  }
  return out
}

describe('presentation formatting is never a rule', () => {
  it('is not reachable from anything that decides a lock or an editability', () => {
    // `kickoff.ts` states this and `format.ts` inherits it: the server decides
    // what is open, locked, played or settled. A model that imported a
    // formatter to make one of those decisions would be deciding a rule from a
    // string, so the models are held clear of the formatters entirely.
    const modelFiles = screenFilesAll(resolve(process.cwd(), 'src/vnext/models'))
    const offenders = modelFiles.filter((file) => {
      const source = readFileSync(file, 'utf8')
      // An IMPORT, not a mention: `models/matches.ts` cites `kickoff.ts` in
      // prose to say which authority owns the rule it is obeying, which is the
      // documentation working rather than the boundary failing.
      return /^\s*import[^\n]*(foundations\/format|shared\/time\/kickoff)/m.test(source)
    })

    expect(modelFiles.length).toBeGreaterThan(5)
    expect(
      offenders.map((file) => file.replace(`${process.cwd()}/`, '')),
      'a vNext model imported a presentation formatter — a printed time can ' +
        'never decide a lock, a state or an editability',
    ).toEqual([])
  })
})
