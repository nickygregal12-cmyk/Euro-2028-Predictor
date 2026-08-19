import { expect, test } from '@playwright/test'

/**
 * THE STAGE 12 SURFACE, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query and computes no layout, so every
 * responsive claim in `tests/vnext/championship.test.tsx` is about the MODEL
 * and the MARKUP. This suite is about the PICTURE — and on this surface the
 * picture IS the deliverable, because the predicate asks for a bracket that
 * "works on phone and desktop without becoming unreadable" and only a layout
 * engine can say whether it does.
 *
 * WHAT IT ASSERTS, and why each one needs a browser:
 *
 *   1. THE BRACKET DOES NOT SCROLL SIDEWAYS AT ANY WIDTH, including a
 *      sixteen-seat draw at 375. This is the assertion the whole layout exists
 *      to satisfy, and the one a scaled tree would fail.
 *   2. ROUNDS STACK ON A PHONE AND RUN AS COLUMNS ON A DESKTOP — measured from
 *      the rendered geometry rather than from the class list, because a
 *      container query that did not apply would leave the classes intact.
 *   3. NO NAME IS CLIPPED at any width, including two forty-character names at
 *      375. A player scanning a draw for their own name must be able to read
 *      it.
 *   4. THERE ARE NO CONNECTOR LINES, in any world, at any width.
 *   5. NO SCORELINE APPEARS on a fully settled bracket.
 *   6. THE PAGE SAYS NOTHING ABOUT ELIMINATION in the world where a derivation
 *      would say it.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280x900, which
 * is the width and height of no frame under review.
 */

const WIDTHS = [
  { story: 'frame-drawn-phone', width: 375, label: '375' },
  { story: 'frame-drawn-large', width: 430, label: '430' },
  { story: 'frame-drawn-tablet', width: 768, label: '768' },
  { story: 'frame-drawn-laptop', width: 1024, label: '1024' },
  { story: 'frame-drawn-wide', width: 1440, label: '1440' },
  { story: 'frame-drawn-desktop', width: 1920, label: '1920' },
] as const

const WORLDS = [
  { story: 'frame-wide-phone', label: 'a sixteen-seat draw at 375' },
  { story: 'frame-wide-tablet', label: 'a sixteen-seat draw at 768' },
  { story: 'frame-wide-desktop', label: 'a sixteen-seat draw at 1920' },
  { story: 'frame-lost-phone', label: 'a lost tie with nothing stated at 375' },
  { story: 'frame-walkover-phone', label: 'two kinds of walkover at 375' },
  { story: 'frame-every-decision-phone', label: 'every settlement vocabulary at 375' },
  { story: 'frame-half-filled-phone', label: 'a half-filled seat at 375' },
  { story: 'frame-champion-phone', label: 'the reader as champion at 375' },
  { story: 'frame-someone-else-won-phone', label: 'somebody else as champion at 375' },
  { story: 'frame-playoff-phone', label: 'a play-off round at 375' },
  { story: 'frame-unlabelled-phone', label: 'an unlabelled round at 375' },
  { story: 'frame-long-names-phone', label: 'two long names at 375' },
  { story: 'frame-long-names-tablet', label: 'two long names at 768' },
  { story: 'frame-not-drawn-phone', label: 'an undrawn knockout at 375' },
  { story: 'frame-not-entered-phone', label: 'a non-entrant at 375' },
  { story: 'frame-unavailable-phone', label: 'a read that did not answer at 375' },
  { story: 'frame-penalty-open-phone', label: 'an open Penalty Number at 375' },
  { story: 'frame-penalty-open-tablet', label: 'an open Penalty Number at 768' },
  { story: 'frame-penalty-zero-phone', label: 'a submitted Penalty Number of zero at 375' },
  { story: 'frame-penalty-locked-phone', label: 'a locked Penalty Number at 375' },
  { story: 'frame-penalty-unsubmitted-phone', label: 'a locked round never submitted to at 375' },
  { story: 'frame-penalty-unscheduled-phone', label: 'an unscheduled Penalty Number at 375' },
] as const

type Reading = {
  frameWidth: number
  horizontalOverflow: number
  mainCount: number
  headingCount: number
  headingIsWired: boolean
  clipped: string[]
  smallTargets: string[]
  /** Distinct client-rect tops of the round sections. 1 means one row. */
  roundRows: number
  /** Distinct client-rect lefts of the round sections. */
  roundColumns: number
  roundCount: number
  /** Any svg, line or path inside the bracket. Must always be zero. */
  connectors: number
  pageText: string
  /** The bracket's own text, for assertions about what a SEAT may say. */
  bracketText: string
  groupTables: number
  groupOverflow: number[]
  /** The intent the harness last recorded, so a press is observed at the seam. */
  lastIntent: string
  /** Whether the submit control is currently disabled. */
  submitDisabled: boolean | null
}

async function read(page: import('@playwright/test').Page): Promise<Reading> {
  return page.evaluate<Reading>(() => {
    const frame = document.querySelector('figure [data-vnext]') as HTMLElement | null
    const scope: ParentNode = frame ?? document

    const rendered = (node: Element) => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return (
        box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
      )
    }

    const describe = (node: Element) => {
      const tag = node.tagName.toLowerCase()
      const label = (node.getAttribute('aria-label') ?? node.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
      return `${tag}: ${label}`
    }

    const clipped: string[] = []
    for (const node of scope.querySelectorAll<HTMLElement>('span, p, h1, h2, li, strong')) {
      if (!rendered(node)) continue
      const style = getComputedStyle(node)
      if (style.clipPath !== 'none') continue
      if (style.textOverflow === 'ellipsis') {
        clipped.push(`${describe(node)} (ellipsis)`)
        continue
      }
      if (style.overflowX !== 'hidden' && style.overflowX !== 'clip') continue
      if (node.scrollWidth - node.clientWidth > 1) {
        clipped.push(`${describe(node)} (${node.scrollWidth} in ${node.clientWidth})`)
      }
    }

    const smallTargets: string[] = []
    // INPUTS ARE CONTROLS. The Penalty Number field is the one thing this page
    // asks a reader to touch, and it was the one control the sweep did not
    // measure while a docblock said it did.
    for (const control of scope.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"], input:not([type="hidden"])',
    )) {
      if (!rendered(control)) continue
      if (getComputedStyle(control).clipPath !== 'none') continue
      // Layout boxes, not client rects: the workshop scales frames with a CSS
      // transform, and a scaled rect reports a 44px control as 18px.
      if (control.offsetWidth < 44 || control.offsetHeight < 44) {
        smallTargets.push(`${describe(control)} @ ${control.offsetWidth}x${control.offsetHeight}`)
      }
    }

    const main = scope.querySelector('main') as HTMLElement | null
    const heading = scope.querySelector('h1')
    const labelledBy = main?.getAttribute('aria-labelledby') ?? null

    const bracket = scope.querySelector('[data-vnext-zone="bracket"]') as HTMLElement | null
    const rounds = [...(bracket?.querySelectorAll('ol > li') ?? [])].filter(rendered)
    const tops = new Set(rounds.map((node) => Math.round(node.getBoundingClientRect().top)))
    const lefts = new Set(rounds.map((node) => Math.round(node.getBoundingClientRect().left)))

    return {
      frameWidth: (frame ?? document.body).getBoundingClientRect().width,
      horizontalOverflow: Math.max(0, (main?.scrollWidth ?? 0) - (main?.clientWidth ?? 0)),
      mainCount: [...scope.querySelectorAll('main')].filter(rendered).length,
      headingCount: [...scope.querySelectorAll('h1')].filter(rendered).length,
      headingIsWired: Boolean(heading && labelledBy && heading.id === labelledBy),
      clipped,
      smallTargets,
      roundRows: tops.size,
      roundColumns: lefts.size,
      roundCount: rounds.length,
      connectors: bracket?.querySelectorAll('svg, line, path').length ?? 0,
      pageText: ((frame ?? document.body).textContent ?? '').replace(/\s+/g, ' ').trim(),
      bracketText: (bracket?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      // THE GROUP TABLE SCROLLS AND THE PAGE DOES NOT. Eight columns do not fit
      // a phone, and the alternative — dropping columns — would be a stylesheet
      // deciding which of the standings authority's measures matter.
      groupTables: scope.querySelectorAll('[data-vnext-zone="groups"] table').length,
      groupOverflow: [...scope.querySelectorAll('[data-vnext-zone="groups"] table')].map(
        (table) => {
          const box = table.parentElement
          if (box === null) return -1
          return getComputedStyle(box).overflowX === 'auto' ? 0 : box.scrollWidth - box.clientWidth
        },
      ),
      lastIntent:
        scope.querySelector('[data-vnext-championship-host]')?.getAttribute(
          'data-vnext-last-intent',
        ) ?? '',
      submitDisabled: (() => {
        const button = scope.querySelector(
          '[data-vnext-zone="penalty-number"] button[type="submit"]',
        ) as HTMLButtonElement | null
        return button === null ? null : button.disabled
      })(),
    }
  })
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-predictor-championship--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-shell] main')
  await page.waitForTimeout(1200)
}

function expectBaseline(reading: Reading, where: string) {
  expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)
  expect(reading.mainCount, `${where} should have exactly one main`).toBe(1)
  expect(reading.headingCount, `${where} should have exactly one h1`).toBe(1)
  expect(reading.headingIsWired, `${where} main is not labelled by its own h1`).toBe(true)
  expect(reading.clipped, `${where} clips text`).toEqual([])
  expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])
  // NO EDGE THIS READ CANNOT JUSTIFY, in every world and at every width.
  expect(reading.connectors, `${where} draws a connector the read cannot justify`).toBe(0)
}

test.describe('the drawn bracket holds at every reviewed width', () => {
  for (const { story, width, label } of WIDTHS) {
    test(`at ${label}`, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)
      expect(Math.round(reading.frameWidth)).toBe(width)
      expectBaseline(reading, `the bracket at ${label}`)
    })
  }
})

test.describe('every world holds the same baseline', () => {
  for (const { story, label } of WORLDS) {
    test(label, async ({ page }) => {
      await open(page, story)
      expectBaseline(await read(page), label)
    })
  }
})

/**
 * THE ASSERTION THE WHOLE LAYOUT EXISTS FOR.
 *
 * A knockout tree fails this: four columns of sixteen seats at 375 either
 * scroll sideways or shrink past legibility. Rounds-as-sections does not, and
 * the proof has to be geometric rather than structural — a container query that
 * silently did not apply would leave every class name in place.
 */
test.describe('the bracket is read down on a phone and across on a desktop', () => {
  test('four rounds stack into four rows at 375', async ({ page }) => {
    await open(page, 'frame-wide-phone')
    const reading = await read(page)
    expect(reading.roundCount).toBe(4)
    expect(reading.roundRows, 'rounds should stack at 375').toBe(4)
    expect(reading.roundColumns, 'rounds should share one column at 375').toBe(1)
    expect(reading.horizontalOverflow, 'a sixteen-seat draw scrolls sideways at 375').toBe(0)
  })

  test('and run as columns at 1920', async ({ page }) => {
    await open(page, 'frame-wide-desktop')
    const reading = await read(page)
    expect(reading.roundCount).toBe(4)
    // The shape a bracket is usually drawn in, reached by WIDENING.
    expect(reading.roundColumns, 'rounds should sit side by side at 1920').toBeGreaterThan(1)
    expect(reading.roundRows, 'rounds should share one row at 1920').toBe(1)
  })

  test('with two across at the middle width', async ({ page }) => {
    await open(page, 'frame-wide-tablet')
    const reading = await read(page)
    expect(reading.roundColumns).toBe(2)
    expect(reading.roundRows).toBe(2)
  })
})

test.describe('the page says only what the read stated', () => {
  test('says nothing about elimination where a derivation would', async ({ page }) => {
    await open(page, 'frame-lost-phone')
    const reading = await read(page)
    // The reader lost their only tie and has no later one.
    expect(reading.pageText).toMatch(/Decided on points/)
    expect(reading.pageText).not.toMatch(/eliminated|knocked out|you are out/i)
  })

  /**
   * SCOPED TO THE BRACKET, and it has to be.
   *
   * An earlier version swept the whole page, which passed only until something
   * legitimate put a colon between two numbers on it — the Penalty Number
   * panel's "Locks Tomorrow 15:00" did exactly that. A clock time is not a
   * scoreline, and an assertion that cannot tell them apart is measuring the
   * wrong region rather than the wrong thing. A SEAT is where a scoreline would
   * appear, so a seat is what this reads.
   */
  test('renders no scoreline on a fully settled bracket', async ({ page }) => {
    await open(page, 'frame-every-decision-phone')
    const reading = await read(page)
    expect(reading.bracketText).toContain('Decided by Penalty Number')
    expect(reading.bracketText).not.toMatch(/\d+\s*[-–:]\s*\d+/)
  })

  test('says why a walkover was awarded only as far as the server did', async ({ page }) => {
    await open(page, 'frame-walkover-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('Walkover, awarded by an organiser')
    expect(reading.pageText).not.toMatch(/withdrew|withdrawn|disqualif/i)
  })

  test('reads a half-filled seat as a hole rather than a person', async ({ page }) => {
    await open(page, 'frame-half-filled-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('To be decided')
    expect(reading.pageText).not.toMatch(/\bPlayer\b/)
    expect(reading.pageText).not.toMatch(/\bbye\b/i)
  })

  test('names the champion, and says the reader is out because the READ said so', async ({ page }) => {
    // THIS CASE CHANGED WITH CONTRACT 208, AND THE CHANGE IS THE POINT.
    //
    // It used to require that the page say NOTHING about elimination here,
    // because no season read carried the fact and naming somebody else as
    // champion is not the same sentence as "you lost". That was right while the
    // gap existed.
    //
    // Contract 208 puts `bonus_competition_entrants.outcome` on the read, and
    // this world's `standing` is now a STATED `eliminated`. Staying silent
    // would mean withholding what the settlement authority actually said.
    //
    // The property that has not changed is the one immediately above, on
    // `frame-lost-phone`: a reader who lost their only tie and whose read
    // carries no outcome is still told nothing. Together the two cases say what
    // matters — elimination is the column's value, never an inference from a
    // lost tie, an absent fixture, a missing seed or somebody else's name on
    // the final.
    await open(page, 'frame-someone-else-won-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('Bo Nilsson')
    expect(reading.pageText).toMatch(/eliminated/i)
  })
})

test.describe('the reader can find themselves in a draw of sixteen', () => {
  test('their tie and their name are both marked in words', async ({ page }) => {
    await open(page, 'frame-wide-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('Your tie')
    expect(reading.pageText).toContain('(you)')
  })
})

test.describe('the states that are not a bracket', () => {
  test('a non-entrant is offered no join door', async ({ page }) => {
    await open(page, 'frame-not-entered-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('not entered')
    expect(reading.pageText.toLowerCase()).not.toContain('join')
  })

  test('only the failed read offers a retry', async ({ page }) => {
    await open(page, 'frame-unavailable-phone')
    expect((await read(page)).pageText).toContain('Try again')

    await open(page, 'frame-not-drawn-phone')
    expect((await read(page)).pageText).not.toContain('Try again')
  })
})

/**
 * THE PENALTY NUMBER, IN A REAL ENGINE.
 *
 * Two of these need a browser rather than jsdom: whether the control actually
 * refuses a value the lane forbids once a person types it, and whether the
 * input and the button both hold their target size once real layout runs. The
 * target sweep in `read()` measures the input as well as the buttons — it did
 * not until this stage's review, while this docblock claimed it did. The
 * narrowest frame the suite renders is 375, not 320.
 *
 * The rest are here because this is the page's one write, and the sealed bid is
 * the one thing on it that must never leak.
 */
test.describe('the Penalty Number states its rule and enforces it', () => {
  test('prints the lane rule beside the box', async ({ page }) => {
    await open(page, 'frame-penalty-open-phone')
    expect((await read(page)).pageText).toContain('odd number from 1 to 99')
  })

  test('refuses a value the lane forbids, once a person types it', async ({ page }) => {
    await open(page, 'frame-penalty-open-phone')
    const input = page.locator('[data-vnext-zone="penalty-number"] input')
    await input.fill('8')
    // Even, in the odd lane. The server would refuse it; the page does not send
    // it, because the constraint was knowable before the write.
    expect((await read(page)).submitDisabled).toBe(true)
  })

  test('accepts one the lane allows, and emits the value pressed', async ({ page }) => {
    await open(page, 'frame-penalty-open-phone')
    const input = page.locator('[data-vnext-zone="penalty-number"] input')
    await input.fill('7')
    expect((await read(page)).submitDisabled).toBe(false)
    await page.locator('[data-vnext-zone="penalty-number"] button[type="submit"]').click()
    await expect
      .poll(async () => (await read(page)).lastIntent)
      .toBe('penalty:7')
  })

  test('shows a submitted ZERO as a submission rather than an empty prompt', async ({ page }) => {
    await open(page, 'frame-penalty-zero-phone')
    const reading = await read(page)
    expect(reading.pageText).toMatch(/Your Penalty Number is 0/)
    expect(reading.pageText).toContain('even number from 0 to 98')
  })

  test('calls an unscheduled round unscheduled rather than closed', async ({ page }) => {
    await open(page, 'frame-penalty-unscheduled-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('no kick-off time yet')
    // Nothing has been missed, so it must not read as a deadline gone by.
    expect(reading.pageText).not.toMatch(/too late/i)
    // And it offers no control at all.
    expect(reading.submitDisabled).toBeNull()
  })

  test('shows the reader their own locked value and offers no control', async ({ page }) => {
    await open(page, 'frame-penalty-locked-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('37')
    expect(reading.submitDisabled).toBeNull()
  })
})

/**
 * THE SEALED BID, SWEPT ACROSS EVERY PENALTY WORLD.
 *
 * Contract 193 returns neither the opponent's value nor whether they have
 * submitted, and the model has no field for either. This is the assertion that
 * would catch a future field being added and rendered.
 */
test.describe('the opponent’s Penalty Number is nowhere on any page', () => {
  for (const story of [
    'frame-penalty-open-phone',
    'frame-penalty-zero-phone',
    'frame-penalty-locked-phone',
    'frame-penalty-unsubmitted-phone',
    'frame-penalty-unscheduled-phone',
  ]) {
    test(story, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)
      expect(reading.pageText).not.toMatch(
        /their (penalty|number)|opponent.s (penalty|number)|they have submitted|has submitted/i,
      )
    })
  }
})

/**
 * THE GROUP PHASE, IN A REAL ENGINE.
 *
 * The Championship's ordinary state for most of a season, and the one this page
 * answered with a single sentence while contract 167 held the standings. Two of
 * these need a browser: whether eight columns overflow the PAGE at 375, and
 * whether the table and the empty bracket coexist without either being clipped.
 */
test.describe('the group phase is a table, and it fits a phone', () => {
  for (const [story, label] of [
    ['frame-group-phase-phone', '375'],
    ['frame-group-phase-tablet', '768'],
    ['frame-group-phase-desktop', '1920'],
  ] as const) {
    test(`renders the tables at ${label} without the page scrolling sideways`, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)
      expectBaseline(reading, `the group phase at ${label}`)
      expect(reading.groupTables).toBe(2)
      // Each table is inside a container that scrolls rather than pushing the
      // page wide. `expectBaseline` already holds the page to zero overflow.
      expect(reading.groupOverflow.every((value) => value <= 0)).toBe(true)
    })
  }

  test('shows the table beside the bracket that does not exist yet', async ({ page }) => {
    await open(page, 'frame-group-phase-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('The knockout draw has not been made yet')
    expect(reading.groupTables).toBeGreaterThan(0)
    // Two reads disagreeing is not a verdict on the reader.
    expect(reading.pageText).not.toMatch(/eliminated|knocked out|you are out/i)
  })

  test('renders one group where the competition was drawn as one', async ({ page }) => {
    await open(page, 'frame-single-group-phone')
    expect((await read(page)).groupTables).toBe(1)
  })

  test('shows no table at all where the competition has no group stage', async ({ page }) => {
    await open(page, 'frame-no-group-stage-phone')
    expect((await read(page)).groupTables).toBe(0)
  })

  test('keeps the bracket when only the group read failed', async ({ page }) => {
    await open(page, 'frame-groups-unavailable-phone')
    const reading = await read(page)
    expect(reading.groupTables).toBe(0)
    // The other read answered, and its panel is intact.
    expect(reading.bracketText).not.toBe('')
  })
})
