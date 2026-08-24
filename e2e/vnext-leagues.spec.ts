import { expect, test } from '@playwright/test'

/**
 * THE STAGE 9 LEAGUES SURFACE, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query and computes no layout, so every
 * responsive, target-size and overflow claim in `tests/vnext/leagues.test.tsx`
 * is about the MODEL and the MARKUP. This suite is about the PICTURE, and about
 * the two interactions a real input device performs.
 *
 * WHAT IT ASSERTS, and why each one needs a browser:
 *
 *   1. NO DISPLAY NAME IS CLIPPED, at any width, including an unbroken
 *      forty-character username and a sixty-character league name. Clipping is
 *      a computed overflow and cannot be seen from markup — and a truncated
 *      name is precisely the failure contract 191 exists to prevent, arriving
 *      through CSS instead of through code.
 *   2. EVERY CONTROL CLEARS 44×44, including a player's name. An inline text
 *      button is about twenty pixels tall; only a layout engine can say what a
 *      rule actually produced.
 *   3. NOTHING OVERFLOWS SIDEWAYS at any width. The table may scroll inside its
 *      own box; the PAGE may not.
 *   4. THE MOVEMENT COLUMN EXISTS ONLY WHERE SOMETHING SETTLED — counted as
 *      rendered columns, side by side with the world where nothing has.
 *   5. PRESSING A PLAYER HANDS THE HOST AN ID AND NEVER A NAME — observed from
 *      the story's own host, by click AND by keyboard, in the world where three
 *      rows share one display name.
 *   6. PRESSING A LEAGUE CHANGES THE TABLE. The chooser has no local state, so
 *      the only honest proof is that a real press produced a different table.
 *   7. A READER WHO IS NOT ON THE PAGE STILL SEES THEIR OWN ROW.
 *   8. NOBODY IS OFFERED A CONTROL THEY MAY NOT USE — no disabled control and
 *      no button at all in a table where no row is openable.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280×900, which
 * is the width and height of no frame under review, so anything inside a frame
 * that measures the window produces a number that cannot be mistaken for right.
 */

/** The season table at every reviewed width. */
const WIDTHS = [
  { story: 'frame-season-phone', width: 375, label: '375' },
  { story: 'frame-season-large', width: 430, label: '430' },
  { story: 'frame-season-tablet', width: 768, label: '768' },
  { story: 'frame-season-laptop', width: 1024, label: '1024' },
  { story: 'frame-season-wide', width: 1440, label: '1440' },
  { story: 'frame-season-desktop', width: 1920, label: '1920' },
] as const

/** Every world, at the widths its composition differs most between. */
const WORLDS = [
  { story: 'frame-duplicate-names-phone', label: 'duplicate names at 375' },
  { story: 'frame-duplicate-names-desktop', label: 'duplicate names at 1920' },
  { story: 'frame-tied-ranks-phone', label: 'tied ranks at 375' },
  { story: 'frame-you-off-page-phone', label: 'a reader off the page at 375' },
  { story: 'frame-nothing-openable-phone', label: 'nobody openable at 375' },
  { story: 'frame-everyone-openable-phone', label: 'everyone openable at 375' },
  { story: 'frame-league-unsettled-phone', label: 'an unsettled league at 375' },
  { story: 'frame-league-settled-phone', label: 'a settled league at 375' },
  { story: 'frame-league-settled-desktop', label: 'a settled league at 1920' },
  { story: 'frame-non-entrants-phone', label: 'members with no entry at 375' },
  { story: 'frame-long-names-phone', label: 'long names at 375' },
  { story: 'frame-long-names-tablet', label: 'long names at 768' },
  { story: 'frame-several-leagues-phone', label: 'five chooser options at 375' },
  { story: 'frame-large-league-laptop', label: 'a 240-member league at 1024' },
  { story: 'frame-league-of-one-phone', label: 'a league of one at 375' },
  { story: 'frame-empty-season-phone', label: 'an empty season at 375' },
  { story: 'frame-season-unavailable-phone', label: 'no season table at 375' },
  { story: 'frame-league-table-unavailable-phone', label: 'no league table at 375' },
] as const

type Reading = {
  frameWidth: number
  horizontalOverflow: number
  mainCount: number
  headingCount: number
  headingIsWired: boolean
  currentDestinations: string[]
  /** Standings rows actually rendered, by their model key. */
  rowKeys: string[]
  /** Any control at all whose box is under 44px. */
  smallTargets: string[]
  /** Elements whose content is wider than their own box. */
  clipped: string[]
  /** How many column headers the standings table has. */
  columnHeaders: string[]
  /** Whether a "your standing" block is on the page. */
  hasPinnedRow: boolean
  /** Accessible names of every control inside the standings region. */
  standingsControls: string[]
  /** Anything the page has marked disabled. */
  disabled: string[]
  /** The chooser options and which one is pressed. */
  chooser: { label: string; pressed: boolean }[]
  /** The whole frame's text, flattened. */
  pageText: string
  /** What the story's host last received. */
  lastIntent: string
  standingsWidth: number
  mainWidth: number
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

    const smallTargets: string[] = []
    for (const control of scope.querySelectorAll<HTMLElement>(
      'button, a[href], [role="button"]',
    )) {
      if (!rendered(control)) continue
      // The skip link is a 1px clipped box UNTIL IT IS FOCUSED, at which point
      // its own rule gives it a 44px target. `clip-path` is what separates
      // "deliberately invisible" from "a control a finger cannot hit".
      if (getComputedStyle(control).clipPath !== 'none') continue
      // Layout boxes, not client rects: the workshop scales frames with a CSS
      // transform, and a scaled rect would report a 44px control as 18px.
      if (control.offsetWidth < 44 || control.offsetHeight < 44) {
        smallTargets.push(`${describe(control)} @ ${control.offsetWidth}x${control.offsetHeight}`)
      }
    }

    // CLIPPING, MEASURED. A display name that does not fit is the defect the
    // long-name world exists to expose, and it is invisible to a DOM assertion.
    //
    // `clip-path` IS THE SEPARATOR between "deliberately invisible" and
    // "accidentally cut off" — the shell suite's own idiom. Every accessible
    // sentence on this page is an sr-only `<span>`: a 1px box holding a whole
    // sentence, overflowing by design.
    //
    // THE TABLE'S OWN SCROLL BOX IS EXEMPT and deliberately so: it is
    // `overflow-x: auto`, which is a scroller rather than a clipper, and it is
    // what keeps the PAGE from scrolling sideways at 375.
    const clipped: string[] = []
    for (const node of scope.querySelectorAll<HTMLElement>('span, p, h1, h2, td, th, a, button')) {
      if (!rendered(node)) continue
      const style = getComputedStyle(node)
      if (style.clipPath !== 'none') continue
      // An ellipsis on a display name is exactly the failure being prevented.
      if (style.textOverflow === 'ellipsis') {
        clipped.push(`${describe(node)} (ellipsis)`)
        continue
      }
      if (style.overflowX !== 'hidden' && style.overflowX !== 'clip') continue
      if (node.scrollWidth - node.clientWidth > 1) {
        clipped.push(`${describe(node)} (${node.scrollWidth} in ${node.clientWidth})`)
      }
    }

    const standings = scope.querySelector('[data-vnext-zone="standings"]') as HTMLElement | null
    const main = scope.querySelector('main') as HTMLElement | null
    const table = standings?.querySelector('table') ?? null

    const heading = scope.querySelector('h1')
    const labelledBy = main?.getAttribute('aria-labelledby') ?? null

    return {
      frameWidth: (frame ?? document.body).getBoundingClientRect().width,
      // MEASURED ON THE PAGE'S OWN LANDMARK, AND DELIBERATELY NOT ON THE FRAME.
      //
      // The workshop frame root is `overflow-x: clip`, which creates no scroll
      // container — so Chromium reports its `scrollWidth` from the union of
      // descendant boxes, INCLUDING ones an intermediate `overflow-x: auto`
      // scroller has already clipped. The Matches suite measures the frame and
      // is right to, because nothing on that page scrolls inside itself. This
      // page has two such scrollers by design — the chooser and the table — and
      // measuring the frame would report both as the page scrolling sideways.
      //
      // `main` is the page, it is the thing the claim is about, and it reports
      // honestly: content genuinely wider than the column still shows up here.
      horizontalOverflow: Math.max(0, (main?.scrollWidth ?? 0) - (main?.clientWidth ?? 0)),
      mainCount: [...scope.querySelectorAll('main')].filter(rendered).length,
      headingCount: [...scope.querySelectorAll('h1')].filter(rendered).length,
      headingIsWired: Boolean(heading && labelledBy && heading.id === labelledBy),
      currentDestinations: [...scope.querySelectorAll('[aria-current]')].map((node) =>
        (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
      rowKeys: [...scope.querySelectorAll('[data-vnext-standings-row]')]
        .filter(rendered)
        .map((node) => node.getAttribute('data-vnext-standings-row') ?? ''),
      smallTargets,
      clipped,
      columnHeaders: [...(table?.querySelectorAll('thead th') ?? [])].map((node) =>
        (node.textContent ?? '').trim(),
      ),
      hasPinnedRow: Boolean(scope.querySelector('[data-vnext-zone="your-standing"]')),
      standingsControls: [...(standings?.querySelectorAll('button') ?? [])]
        .filter(rendered)
        .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()),
      disabled: [...scope.querySelectorAll('[disabled], [aria-disabled="true"]')].map(describe),
      chooser: [
        ...(scope.querySelector('[data-vnext-zone="chooser"]')?.querySelectorAll('button') ?? []),
      ].map((node) => ({
        label: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
        pressed: node.getAttribute('aria-pressed') === 'true',
      })),
      pageText: ((frame ?? document.body).textContent ?? '').replace(/\s+/g, ' ').trim(),
      lastIntent:
        scope.querySelector('[data-vnext-leagues-host]')?.getAttribute('data-vnext-last-intent') ??
        '',
      standingsWidth: standings?.getBoundingClientRect().width ?? 0,
      mainWidth: main?.getBoundingClientRect().width ?? 0,
    }
  })
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-leagues--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-shell] main')
  // The masthead and the table each enter with a rise; measuring mid-entrance
  // reads transformed boxes rather than laid-out ones.
  await page.waitForTimeout(1200)
}

/** Every world owes the same baseline, whatever it is demonstrating. */
function expectBaseline(reading: Reading, where: string) {
  expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)
  expect(reading.mainCount, `${where} should have exactly one main`).toBe(1)
  expect(reading.headingCount, `${where} should have exactly one h1`).toBe(1)
  expect(reading.headingIsWired, `${where} main is not labelled by its own h1`).toBe(true)
  expect(reading.clipped, `${where} clips text`).toEqual([])
  expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])

  // NOTHING IS EVER OFFERED AND REFUSED. A closed row is plain text; a disabled
  // control would advertise something the reader cannot have.
  expect(reading.disabled, `${where} has a disabled control`).toEqual([])

  // The shell still says where the player is, and it says Leagues.
  expect(
    reading.currentDestinations.filter((label) => label.includes('Leagues')).length,
    `${where} should mark Leagues as the current destination`,
  ).toBeGreaterThan(0)
}

test.describe('the standings survive every width', () => {
  for (const { story, width, label } of WIDTHS) {
    test(`the season table at ${label} holds its shape`, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)

      expectBaseline(reading, `the season table at ${label}`)
      expect(reading.frameWidth, `the ${label} frame should be ${width} wide`).toBeCloseTo(
        width,
        0,
      )
      expect(reading.rowKeys.length, `the season table at ${label} rendered no rows`).toBe(6)

      // The table takes the working column rather than a sliver of it.
      expect(
        reading.standingsWidth / reading.mainWidth,
        `the standings at ${label} do not use the column`,
      ).toBeGreaterThan(0.5)
    })
  }
})

test.describe('every world holds the baseline', () => {
  for (const { story, label } of WORLDS) {
    test(`${label} holds the baseline`, async ({ page }) => {
      await open(page, story)
      expectBaseline(await read(page), label)
    })
  }
})

test.describe('a long name is never cut', () => {
  test('an unbroken forty-character username wraps rather than clipping', async ({ page }) => {
    await open(page, 'frame-long-names-phone')
    const reading = await read(page)

    // The baseline already proves nothing clips; this proves the name is
    // actually THERE in full rather than shortened before it was drawn.
    expect(reading.pageText).toContain('Averyveryverylongsinglewordusernamewithnobreaks')
    expect(reading.pageText).toContain('Bartholomew Fitzwilliam-Cholmondeley')
    expect(reading.pageText).toContain(
      'The Thursday Night Extremely Competitive Prediction Society',
    )
    expect(reading.pageText, 'a name was abbreviated with an ellipsis').not.toContain('…')
  })
})

test.describe('the movement column exists only where something settled', () => {
  test('an unsettled league draws no movement column at all', async ({ page }) => {
    await open(page, 'frame-league-unsettled-phone')
    const reading = await read(page)

    expect(reading.columnHeaders).toEqual(['Rank', 'Player', 'Points'])
    // A column of dashes would say "nobody moved"; the truth is that nothing
    // has settled, and the page says so in words instead.
    expect(reading.pageText).toContain('Movement appears once a matchweek settles')
  })

  test('a settled league draws one, with words beside the arrows', async ({ page }) => {
    await open(page, 'frame-league-settled-phone')
    const reading = await read(page)

    expect(reading.columnHeaders).toEqual(['Rank', 'Player', 'Moved', 'Points'])
    expect(reading.pageText).toContain('up 3 places since Matchweek 12')
    expect(reading.pageText).toContain('down 1 place since Matchweek 12')
    expect(reading.pageText).toContain('no change since Matchweek 12')
  })
})

test.describe('a reader who is not on the page still gets an answer', () => {
  test('the reader`s own row is pinned below the table', async ({ page }) => {
    await open(page, 'frame-you-off-page-phone')
    const reading = await read(page)

    expect(reading.hasPinnedRow).toBe(true)
    expect(reading.pageText).toContain('Your standing')
    expect(reading.pageText).toContain('318')
    expect(reading.pageText).toContain('Showing 3 of 412 players')
  })

  test('a reader who IS on the page is not pinned twice', async ({ page }) => {
    await open(page, 'frame-season-phone')
    const reading = await read(page)

    expect(reading.hasPinnedRow).toBe(false)
    expect(reading.pageText.match(/Nicky Gregal/g) ?? []).toHaveLength(1)
  })
})

test.describe('nobody is offered a door they may not open', () => {
  test('a table where no row is openable has no control in it at all', async ({ page }) => {
    await open(page, 'frame-nothing-openable-phone')
    const reading = await read(page)

    expect(reading.standingsControls, 'a stranger was drawn as a control').toEqual([])
    expect(reading.disabled).toEqual([])
  })

  test('a row the server addressed no profile for is not a control', async ({ page }) => {
    await open(page, 'frame-everyone-openable-phone')
    const reading = await read(page)

    // Søren's reach said profile and carried no id.
    expect(reading.pageText).toContain('Søren Kjær')
    expect(reading.standingsControls).not.toContain('Søren Kjær')
    expect(reading.standingsControls).toContain('Jamie Ferguson-Whyte')
  })
})

test.describe('pressing a player hands the host an id and never a name', () => {
  test('by click, in the world where three rows share one name', async ({ page }) => {
    await open(page, 'frame-duplicate-names-phone')

    // Three rows read "Sam Docherty"; exactly one is a control.
    const buttons = page.locator('[data-vnext-zone="standings"] button', {
      hasText: 'Sam Docherty',
    })
    await expect(buttons).toHaveCount(1)

    await buttons.first().click()
    const reading = await read(page)

    // THE ID, AND ONLY THE ID. The harness records what the page emitted, so
    // this is the emission rather than a re-reading of the element pressed.
    expect(reading.lastIntent).toBe('openPlayer:player-sam-a@ref-sam-a')
    expect(reading.lastIntent).not.toContain('Sam')
  })

  test('by keyboard, reaching the same control and the same id', async ({ page }) => {
    await open(page, 'frame-duplicate-names-phone')

    const button = page
      .locator('[data-vnext-zone="standings"] button', { hasText: 'Sam Docherty' })
      .first()
    await button.focus()
    await page.keyboard.press('Enter')

    expect((await read(page)).lastIntent).toBe('openPlayer:player-sam-a@ref-sam-a')
  })

  test('and the three rows stay three rows', async ({ page }) => {
    await open(page, 'frame-duplicate-names-phone')
    const reading = await read(page)

    // Keyed by reference, so React cannot reuse one person's row for another.
    expect(reading.rowKeys).toEqual(['ref-sam-a', 'ref-sam-b', 'ref-sam-you', 'ref-alex'])
  })
})

test.describe('pressing a league changes the table', () => {
  test('the chooser swaps the table rather than moving a highlight', async ({ page }) => {
    await open(page, 'frame-several-leagues-phone')

    const before = await read(page)
    expect(before.chooser.map((option) => option.pressed)).toContain(true)
    const pressedBefore = before.chooser.find((option) => option.pressed)?.label ?? ''
    expect(pressedBefore).toContain('Old School Friends')

    await page
      .locator('[data-vnext-zone="chooser"] button', { hasText: 'Sunday Club' })
      .first()
      .click()
    await page.waitForTimeout(600)

    const after = await read(page)
    // THE TABLE CHANGED, which is the only honest proof: the page holds no
    // scope state, so a highlight that moved without the rows moving would mean
    // the chooser had started claiming a table nobody read.
    expect(after.lastIntent).toBe('scope:league-sunday-club')
    expect(after.rowKeys).not.toEqual(before.rowKeys)
    expect(after.chooser.find((option) => option.pressed)?.label ?? '').toContain('Sunday Club')
  })

  test('a page with nothing to switch between draws no chooser', async ({ page }) => {
    await open(page, 'frame-nothing-openable-phone')
    const reading = await read(page)

    expect(reading.chooser).toEqual([])
    expect(reading.pageText).toContain('not in a private league')
  })
})

test.describe('an empty answer is a sentence, not an empty table', () => {
  test('a season nobody has entered', async ({ page }) => {
    await open(page, 'frame-empty-season-phone')
    const reading = await read(page)

    expect(reading.columnHeaders).toEqual([])
    expect(reading.pageText).toContain('Nobody has entered this season yet.')
    // AND NOT AN APOLOGY. Zero is the server's answer.
    expect(reading.pageText).not.toContain('could not')
  })

  test('a season table that did not answer says so instead', async ({ page }) => {
    await open(page, 'frame-season-unavailable-phone')
    const reading = await read(page)

    expect(reading.pageText).toContain('could not load the season table')
    // IT DOES NOT DENY THE PLAYERS.
    expect(reading.pageText).not.toContain('Nobody has entered')
  })
})

/**
 * THE SCOPE CHOOSER IS THE SIZE OF ITS OPTIONS.
 *
 * As a block-level flex container it took the whole column, which is right on a
 * phone — the options fill it and it scrolls — and wrong on a desktop, where
 * three options occupied 335px of an 1112px pill and left 777px of empty sunken
 * surface trailing off to the right. It also broke the column's edge: the
 * standings below stop at the 960px measure `.tableRegion` sets, so the two
 * stacked siblings disagreed by 152px on the right.
 *
 * BOTH HALVES ARE ASSERTED, because fixing one by breaking the other is the
 * obvious wrong move: `width: fit-content` alone would let a long league name
 * push the pill past the column and take the page sideways with it, and the
 * phone case is the one where that actually happens.
 */
test.describe('the scope chooser is a control, not a column', () => {
  test('hugs its options on a desktop instead of trailing off', async ({ page }) => {
    await open(page, 'frame-season-desktop')

    const reading = await page.evaluate(() => {
      const scope = document.querySelector('nav[class*="scope"]') ?? document.querySelector('[class*="scope"]')
      if (!(scope instanceof HTMLElement)) throw new Error('no scope chooser')
      const options = [...scope.querySelectorAll('button')]
      const furthest = options.at(-1)
      if (!furthest) throw new Error('the scope chooser rendered no options')
      const last = furthest.getBoundingClientRect()
      const box = scope.getBoundingClientRect()
      const column = scope.parentElement as HTMLElement
      // THE CHOOSER IS NAMED, NOT FILTERED INTO THE COMPARISON. Picking the
      // siblings to compare by a width threshold would drop the chooser itself
      // the moment it became narrow — which is one of the ways this layout can
      // go wrong — and an alignment assertion over the remaining one element is
      // vacuously true. Both edges are read directly instead.
      const panel = [...column.children].find((child) => child !== scope)
      if (!(panel instanceof HTMLElement)) throw new Error('no panel under the chooser')
      return {
        options: options.length,
        emptyToTheRight: Math.round(box.right - last.right),
        columnWidth: Math.round(column.getBoundingClientRect().width),
        pillWidth: Math.round(box.width),
        chooserLeft: Math.round(box.left),
        panelLeft: Math.round(panel.getBoundingClientRect().left),
        panelWidth: Math.round(panel.getBoundingClientRect().width),
      }
    })

    expect(reading.options, 'the desktop story has too few options to prove anything').toBeGreaterThan(1)
    // The trailing gap is the padding and nothing else.
    expect(
      reading.emptyToTheRight,
      `the chooser leaves ${reading.emptyToTheRight}px of empty control past its last option`,
    ).toBeLessThanOrEqual(8)
    expect(
      reading.pillWidth,
      'the chooser still spans the whole column',
    ).toBeLessThan(reading.columnWidth)
    // The panel is the thing that sets the measure, so it has to still be the
    // wider of the two — otherwise "the chooser is narrower than its column"
    // above could be satisfied by a collapsed panel rather than a hugging pill.
    expect(
      reading.panelWidth,
      'the panel below the chooser is no wider than the chooser',
    ).toBeGreaterThan(reading.pillWidth)
    // What replaces the old right-edge agreement: the control and the panel
    // below it start together, which is the alignment a reader actually sees.
    expect(reading.chooserLeft, 'the chooser and the panel below it start apart').toBe(
      reading.panelLeft,
    )
  })

  test('still scrolls inside itself rather than widening a phone', async ({ page }) => {
    await open(page, 'frame-several-leagues-phone')

    const reading = await page.evaluate(() => {
      const scope = document.querySelector('[class*="scope"]')
      if (!(scope instanceof HTMLElement)) throw new Error('no scope chooser')
      const main = document.querySelector('[data-vnext-shell] main') as HTMLElement
      return {
        pillWidth: Math.round(scope.getBoundingClientRect().width),
        columnWidth: Math.round((scope.parentElement as HTMLElement).getBoundingClientRect().width),
        hiddenInside: scope.scrollWidth - scope.clientWidth,
        overflowX: getComputedStyle(scope).overflowX,
        pageOverflow: main.scrollWidth - main.clientWidth,
      }
    })

    expect(reading.pillWidth, 'the chooser is wider than its column').toBeLessThanOrEqual(
      reading.columnWidth,
    )
    expect(reading.pageOverflow, 'the chooser took the page sideways').toBe(0)
    // THE POINT OF THE PHONE CASE, AND IT HAS TO BE ASSERTED RATHER THAN JUST
    // MEASURED. This story has more leagues than fit, so options ARE off the
    // end of the pill. Without this, `overflow-x` could become `hidden` and the
    // two assertions above would still pass while the options it clipped became
    // unreachable — the page stays the right width either way. The reachable
    // overflow is the contract; the page not moving is only half of it.
    expect(
      reading.hiddenInside,
      'the chooser has nothing hidden inside it, so this story proves nothing',
    ).toBeGreaterThan(0)
    expect(reading.overflowX, 'the hidden options cannot be scrolled to').toBe('auto')
  })
})
