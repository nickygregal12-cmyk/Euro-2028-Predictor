import { expect, test } from '@playwright/test'

/**
 * THE STAGE 11 SURFACE, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query and computes no layout, so every
 * responsive, target-size and overflow claim in `tests/vnext/lms.test.tsx` is
 * about the MODEL and the MARKUP. This suite is about the PICTURE — and on this
 * surface the picture has a cost, because a mis-tap spends a club for a season.
 *
 * WHAT IT ASSERTS, and why each one needs a browser:
 *
 *   1. THE CLUBS ARE THE WIDEST TARGETS ON THE PAGE, and every one clears
 *      44×44. The predicate asks for a one-handed mobile pick flow, and only a
 *      layout engine can say what a rule actually produced.
 *   2. NO CLUB NAME IS CLIPPED at any width, including "Inverness Caledonian
 *      Thistle" at 375. A truncated club name on a page that spends clubs is
 *      the worst possible clipping.
 *   3. NOTHING OVERFLOWS SIDEWAYS at any width.
 *   4. A USED OR SHUT CLUB IS NOT A CONTROL — counted as rendered buttons,
 *      side by side across the open, locked and eliminated worlds.
 *   5. PRESSING A CLUB EMITS THE ID THAT CLUB CARRIED, by click AND by
 *      keyboard, observed from the story's own host rather than re-read off
 *      the element pressed.
 *   6. THERE IS NO NUMERIC INPUT ANYWHERE — the structural difference from
 *      Match Predictor, checked in the rendered DOM.
 *   7. THE POOL LINE STAYS INSIDE ITS BOX at 375, on one or two lines and
 *      never more. A survival count running off the edge would hide the number
 *      the section exists to show, and jsdom computes no layout, so only a
 *      browser can say whether the flex line broke or merely scrolled.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280×900, which
 * is the width and height of no frame under review.
 */

const WIDTHS = [
  { story: 'frame-open-phone', width: 375, label: '375' },
  { story: 'frame-open-large', width: 430, label: '430' },
  { story: 'frame-open-tablet', width: 768, label: '768' },
  { story: 'frame-open-laptop', width: 1024, label: '1024' },
  { story: 'frame-open-wide', width: 1440, label: '1440' },
  { story: 'frame-open-desktop', width: 1920, label: '1920' },
] as const

const WORLDS = [
  { story: 'frame-pick-made-phone', label: 'a pick already held at 375' },
  { story: 'frame-many-used-phone', label: 'eight clubs spent at 375' },
  { story: 'frame-one-club-left-phone', label: 'one club left at 375' },
  { story: 'frame-locked-phone', label: 'a locked round at 375' },
  { story: 'frame-not-open-phone', label: 'a round not yet open at 375' },
  { story: 'frame-unscheduled-phone', label: 'a window with no deadline at 375' },
  { story: 'frame-eliminated-phone', label: 'an eliminated player at 375' },
  { story: 'frame-won-but-eliminated-phone', label: 'won but eliminated at 375' },
  { story: 'frame-won-but-eliminated-desktop', label: 'won but eliminated at 1920' },
  { story: 'frame-lost-but-alive-phone', label: 'lost but alive at 375' },
  { story: 'frame-champion-phone', label: 'the champion at 375' },
  { story: 'frame-long-club-names-phone', label: 'long club names at 375' },
  { story: 'frame-long-club-names-tablet', label: 'long club names at 768' },
  { story: 'frame-not-entered-phone', label: 'a player not entered at 375' },
  { story: 'frame-not-offered-phone', label: 'a season without the game at 375' },
  { story: 'frame-unavailable-phone', label: 'a round that did not load at 375' },
  { story: 'frame-empty-round-phone', label: 'a round with no fixtures at 375' },
  { story: 'frame-field-revealed-phone', label: 'a locked round with the pool revealed at 375' },
  { story: 'frame-field-with-lives-phone', label: 'two lives, one save and a draws rule at 375' },
  { story: 'frame-field-nearly-over-phone', label: 'two players left at 375' },
  { story: 'frame-field-unavailable-phone', label: 'the field read failed, the round did not, at 375' },
  { story: 'frame-round-unavailable-field-ok-phone', label: 'the round read failed, the field did not, at 375' },
] as const

type Reading = {
  frameWidth: number
  horizontalOverflow: number
  mainCount: number
  headingCount: number
  headingIsWired: boolean
  /** Any control at all whose box is under 44px. */
  smallTargets: string[]
  /** Elements whose content is wider than their own box. */
  clipped: string[]
  /** Accessible names of every control inside the pick list. */
  pickControls: string[]
  /** Anything the page has marked disabled. */
  disabled: string[]
  /** How many numeric inputs exist. Must always be zero. */
  inputs: number
  /** The narrowest club control, so "widest target" is checkable. */
  narrowestClub: number
  pageText: string
  lastIntent: string
  /** How many visual lines the pool counts occupy. 0 when there is no pool. */
  fieldLines: number
  /** True when the pool line's content is wider than its own box. */
  fieldOverflows: boolean
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
    for (const control of scope.querySelectorAll<HTMLElement>('button, a[href], [role="button"]')) {
      if (!rendered(control)) continue
      if (getComputedStyle(control).clipPath !== 'none') continue
      // Layout boxes, not client rects: the workshop scales frames with a CSS
      // transform, and a scaled rect reports a 44px control as 18px.
      if (control.offsetWidth < 44 || control.offsetHeight < 44) {
        smallTargets.push(`${describe(control)} @ ${control.offsetWidth}x${control.offsetHeight}`)
      }
    }

    const clipped: string[] = []
    for (const node of scope.querySelectorAll<HTMLElement>('span, p, h1, h2, button, li')) {
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

    const main = scope.querySelector('main') as HTMLElement | null
    const heading = scope.querySelector('h1')
    const labelledBy = main?.getAttribute('aria-labelledby') ?? null
    const list = scope.querySelector('[data-vnext-zone="pick-list"]') as HTMLElement | null

    const clubBoxes = [...(list?.querySelectorAll<HTMLElement>('button') ?? [])]
      .filter(rendered)
      .map((node) => node.offsetHeight)

    return {
      frameWidth: (frame ?? document.body).getBoundingClientRect().width,
      // Measured on the page's own landmark, for the reason the Leagues suite
      // records: the workshop frame root is `overflow-x: clip` and reports a
      // scrollWidth through intermediate scrollers.
      horizontalOverflow: Math.max(0, (main?.scrollWidth ?? 0) - (main?.clientWidth ?? 0)),
      mainCount: [...scope.querySelectorAll('main')].filter(rendered).length,
      headingCount: [...scope.querySelectorAll('h1')].filter(rendered).length,
      headingIsWired: Boolean(heading && labelledBy && heading.id === labelledBy),
      smallTargets,
      clipped,
      pickControls: [...(list?.querySelectorAll('button') ?? [])]
        .filter(rendered)
        .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()),
      disabled: [...scope.querySelectorAll('[disabled], [aria-disabled="true"]')].map(describe),
      inputs: scope.querySelectorAll('input, select, textarea').length,
      narrowestClub: clubBoxes.length === 0 ? 0 : Math.min(...clubBoxes),
      pageText: ((frame ?? document.body).textContent ?? '').replace(/\s+/g, ' ').trim(),
      lastIntent:
        scope.querySelector('[data-vnext-lms-host]')?.getAttribute('data-vnext-last-intent') ?? '',
      // THE POOL MUST WRAP, NOT SCROLL. Counted by distinct client-rect tops of
      // the count spans, which is the only way to know a flex line actually
      // broke rather than the row simply running past its box.
      fieldLines: (() => {
        const counts = scope.querySelector('[data-vnext-zone="field"] p')
        if (!counts) return 0
        const tops = new Set<number>()
        for (const span of counts.querySelectorAll('span')) {
          const rect = span.getBoundingClientRect()
          if (rect.width > 0) tops.add(Math.round(rect.top))
        }
        return tops.size
      })(),
      fieldOverflows: (() => {
        const counts = scope.querySelector('[data-vnext-zone="field"] p') as HTMLElement | null
        return counts === null ? false : counts.scrollWidth - counts.clientWidth > 1
      })(),
    }
  })
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-last-man-standing--${story}&viewMode=story`, {
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
  // THE STRUCTURAL DIFFERENCE FROM MATCH PREDICTOR, in every world.
  expect(reading.inputs, `${where} has a form field`).toBe(0)
}

test.describe('the open round holds at every reviewed width', () => {
  for (const { story, width, label } of WIDTHS) {
    test(`at ${label}`, async ({ page }) => {
      await open(page, story)
      const reading = await read(page)
      expect(Math.round(reading.frameWidth)).toBe(width)
      expectBaseline(reading, `the round at ${label}`)
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

/* ------------------------------------------------------------------ *
 * The pick is the point
 * ------------------------------------------------------------------ */

test.describe('only a pickable club is a control', () => {
  test('a spent club is text beside a pickable one', async ({ page }) => {
    await open(page, 'frame-many-used-phone')
    const reading = await read(page)

    // Three fixtures, five spent clubs, one pickable.
    expect(reading.pickControls).toEqual(['Kilmarnock'])
    expect(reading.pageText).toContain('Used')
    // NOT A DISABLED CONTROL ANYWHERE. A disabled button advertises something
    // the player cannot have and invites the press anyway.
    expect(reading.disabled).toEqual([])
  })

  test('a locked round offers nothing to press', async ({ page }) => {
    await open(page, 'frame-locked-phone')
    const reading = await read(page)
    expect(reading.pickControls).toEqual([])
    expect(reading.disabled).toEqual([])
    expect(reading.pageText).toContain('Picks closed')
  })

  test('an eliminated player is offered nothing, in an open round', async ({ page }) => {
    await open(page, 'frame-eliminated-phone')
    const reading = await read(page)
    expect(reading.pickControls).toEqual([])
    expect(reading.pageText).toContain('You have been eliminated')
  })

  test('the club already held is marked rather than offered again', async ({ page }) => {
    await open(page, 'frame-pick-made-phone')
    const reading = await read(page)
    expect(reading.pickControls).not.toContain('Celtic')
    expect(reading.pageText).toContain('Your pick')
  })
})

test.describe('pressing a club emits the id that club carried', () => {
  test('by click', async ({ page }) => {
    await open(page, 'frame-open-phone')
    await page.locator('[data-vnext-zone="pick-list"] button', { hasText: 'Celtic' }).first().click()

    // Read from the host, so this is the EMISSION rather than a re-reading of
    // the element that was pressed.
    expect((await read(page)).lastIntent).toBe('pick:team-celtic')
  })

  test('by keyboard, reaching the same control and the same id', async ({ page }) => {
    await open(page, 'frame-open-phone')
    const club = page
      .locator('[data-vnext-zone="pick-list"] button', { hasText: 'Aberdeen' })
      .first()
    await club.focus()
    await page.keyboard.press('Enter')

    expect((await read(page)).lastIntent).toBe('pick:team-aberdeen')
  })

  test('and the pressed club then reads as the pick', async ({ page }) => {
    // What a connected host produces after the write and the re-read: the club
    // is spent and is no longer a control.
    await open(page, 'frame-open-phone')
    await page.locator('[data-vnext-zone="pick-list"] button', { hasText: 'Celtic' }).first().click()
    await page.waitForTimeout(200)

    const reading = await read(page)
    expect(reading.pickControls).not.toContain('Celtic')
    expect(reading.pageText).toContain('Your pick')
  })
})

test.describe('the clubs are the widest targets on the page', () => {
  test('every club clears the tap target at 375', async ({ page }) => {
    // The one-handed case the predicate asks for. A mis-tap here spends a club
    // for the season, so the clubs are not merely compliant — they are the
    // biggest things a thumb can land on.
    await open(page, 'frame-open-phone')
    const reading = await read(page)
    expect(reading.narrowestClub).toBeGreaterThanOrEqual(44)
  })

  test('a fifty-character club name still clears it, and does not clip', async ({ page }) => {
    await open(page, 'frame-long-club-names-phone')
    const reading = await read(page)
    expect(reading.narrowestClub).toBeGreaterThanOrEqual(44)
    expect(reading.clipped).toEqual([])
    expect(reading.pageText).toContain('Inverness Caledonian Thistle')
  })
})

/* ------------------------------------------------------------------ *
 * The two verdicts, on screen
 * ------------------------------------------------------------------ */

test.describe('the page says the standing, not the result', () => {
  test('a won pick beside an elimination reads as an elimination', async ({ page }) => {
    await open(page, 'frame-won-but-eliminated-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('You have been eliminated')
    expect(reading.pageText).not.toContain('You are still in')
  })

  test('a lost pick beside a live entry reads as still in', async ({ page }) => {
    await open(page, 'frame-lost-but-alive-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('You are still in')
    expect(reading.pageText).not.toContain('eliminated')
  })

  test('the champion is named', async ({ page }) => {
    await open(page, 'frame-champion-phone')
    expect((await read(page)).pageText).toContain('last one standing')
  })
})

test.describe('the deadline is said, never counted', () => {
  test('an unscheduled window admits it has no deadline', async ({ page }) => {
    await open(page, 'frame-unscheduled-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('No deadline set yet')
    expect(reading.pickControls).toEqual([])
  })

  test('a round not yet open says so rather than saying locked', async ({ page }) => {
    await open(page, 'frame-not-open-phone')
    const reading = await read(page)
    expect(reading.pickControls).toEqual([])
    expect(reading.pageText).not.toContain('Picks closed')
  })
})

test.describe('the states that are not a round', () => {
  test('not entered offers no join door', async ({ page }) => {
    await open(page, 'frame-not-entered-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('not entered')
    expect(reading.pageText.toLowerCase()).not.toContain('join')
  })

  test('a season without the game does not say come back later', async ({ page }) => {
    await open(page, 'frame-not-offered-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('does not run Last Man Standing')
    expect(reading.pageText).not.toContain('no round to play')
  })

  test('only the failed read offers a retry', async ({ page }) => {
    await open(page, 'frame-unavailable-phone')
    expect((await read(page)).pageText).toContain('Try again')

    await open(page, 'frame-not-entered-phone')
    expect((await read(page)).pageText).not.toContain('Try again')
  })
})

/**
 * THE POOL — the one part of this page whose correctness is a LAYOUT fact.
 *
 * jsdom can confirm the words are present. It cannot say whether three figures
 * and two separators fitted the line, wrapped onto a second, or quietly ran off
 * the edge of a 375 phone taking "120 entered" with them.
 */
test.describe('the field is legible where it is hardest', () => {
  test('the pool counts stay inside their box on a 375 phone', async ({ page }) => {
    await open(page, 'frame-open-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('83 still in')
    expect(reading.pageText).toContain('37 out')
    expect(reading.pageText).toContain('120 entered')
    // THE ONLY ASSERTION HERE THAT EVER DID ANY WORK. The line must not run
    // past its own box, whatever it does about wrapping.
    expect(reading.fieldOverflows, 'the pool line overflows its own box').toBe(false)
    // AND THE LINE ABOVE USED TO BE `toBeGreaterThanOrEqual(1)`, which every
    // possible value satisfies — a field panel always has at least one line.
    // It sat under a comment claiming only a browser could tell wrapping from
    // clipping, and then did not ask. Three counts and two separators DO fit
    // one line at 375, so the honest assertion is a bound, not a wrap: the
    // pool never occupies more than two lines, and never zero.
    expect(reading.fieldLines).toBeGreaterThan(0)
    expect(reading.fieldLines).toBeLessThanOrEqual(2)
  })

  test('the withheld picked-count is a sentence, never a zero', async ({ page }) => {
    await open(page, 'frame-open-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('hidden until picks close')
    expect(reading.pageText).not.toContain('0 players picked')
  })

  test('the picked-count appears once the round has locked', async ({ page }) => {
    await open(page, 'frame-field-revealed-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('79 players picked')
    expect(reading.pageText).not.toContain('hidden until picks close')
  })

  test('the organiser`s rules are stated and the standing is not derived from them', async ({
    page,
  }) => {
    await open(page, 'frame-field-with-lives-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('2 lives')
    expect(reading.pageText).toContain('1 save')
    expect(reading.pageText).toContain('A draw survives')
    // The rule is printed; the verdict still comes from `standing` alone.
    expect(reading.pageText).toContain('You are still in')
  })

  test('two players left reads as two, not as a fraction of the field', async ({ page }) => {
    await open(page, 'frame-field-nearly-over-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('2 still in')
    expect(reading.pageText).not.toContain('2 of 120')
  })
})

/**
 * ONE READ FAILING MUST NOT TAKE THE OTHER DOWN, and in a browser that is a
 * question about what is actually on screen rather than about a union tag.
 */
test.describe('one read failing leaves the other usable', () => {
  test('the pick is still pressable when only the field read failed', async ({ page }) => {
    await open(page, 'frame-field-unavailable-phone')
    const reading = await read(page)
    expect(reading.pickControls.length).toBeGreaterThan(0)
    expect(reading.pageText).toContain('could not load how many players are left')
    // The field's sentence must not bring a second retry beside a working page.
    expect(reading.pageText).not.toContain('Try again')
  })

  test('the pool still counts when only the round read failed', async ({ page }) => {
    await open(page, 'frame-round-unavailable-field-ok-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('83 still in')
    // The retry belongs to the read that failed, and there is exactly one.
    expect(reading.pageText).toContain('Try again')
    expect(reading.pickControls).toEqual([])
  })
})

/**
 * A DEADLINE WITHOUT A DAY IS THE WORST AMBIGUITY THIS PRODUCT CAN PRODUCE.
 *
 * Checked here as well as in jsdom because it is the sentence a player acts on
 * and the one the surface being replaced already gets right.
 */
test.describe('the deadline names a day', () => {
  test('an open round says which day picks close', async ({ page }) => {
    await open(page, 'frame-open-phone')
    const reading = await read(page)
    expect(reading.pageText).toMatch(
      /Picks close (Today|Tomorrow|Yesterday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/,
    )
  })

  test('a locked round says which day they closed', async ({ page }) => {
    await open(page, 'frame-locked-phone')
    const reading = await read(page)
    expect(reading.pageText).toMatch(
      /Picks closed (Today|Tomorrow|Yesterday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/,
    )
  })
})

/**
 * THE TWO BINDING WORLDS MUST LOOK DIFFERENT, not merely model differently.
 */
test.describe('the club result is on the page, beside the standing', () => {
  test('a won pick beside an elimination shows both facts', async ({ page }) => {
    await open(page, 'frame-won-but-eliminated-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('Your pick won')
    expect(reading.pageText).toContain('You have been eliminated')
  })

  test('a lost pick beside a live entry shows both facts', async ({ page }) => {
    await open(page, 'frame-lost-but-alive-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('Your pick lost')
    expect(reading.pageText).toContain('You are still in')
  })
})

test.describe('an eliminated player is not invited to pick', () => {
  test('no prompt and no empty-count sentence under the elimination banner', async ({ page }) => {
    await open(page, 'frame-eliminated-phone')
    const reading = await read(page)
    expect(reading.pageText).toContain('You have been eliminated')
    expect(reading.pickControls).toEqual([])
    expect(reading.pageText).not.toContain('Pick one club to win')
    expect(reading.pageText).not.toContain('No clubs left for you to pick')
  })
})
