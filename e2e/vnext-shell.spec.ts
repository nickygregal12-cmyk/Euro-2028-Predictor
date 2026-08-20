import { expect, test } from '@playwright/test'

/**
 * THE SELECTED vNEXT SHELL, MEASURED BY A REAL ENGINE.
 *
 * jsdom evaluates no container query and computes no layout, so every
 * responsive and scale claim in `tests/vnext/shell.test.tsx` and
 * `tests/vnext/shellIa.test.tsx` is about the MODEL and the MARKUP. This suite
 * is about the picture.
 *
 * WHAT IT ASSERTS, and why each one needs a browser:
 *
 *   1. exactly one primary navigation is REAL at any width. Both shapes — the
 *      phone's bottom bar and the desktop rail — are always in the DOM and CSS
 *      hides one, so only a layout engine can say which. A duplicate here is a
 *      focus stop nobody can see.
 *   2. THE PERMANENT CHROME DOES NOT GROW WITH THE PLATFORM. This is the
 *      measurement Stage 7.6 exists for: one competition, four, twelve and a
 *      twenty-competition catalogue must all produce chrome of the same size.
 *      It cannot be asserted from markup, because the defect is a rail that
 *      quietly gets taller.
 *   3. the one-competition contract, as a picture: no chooser, no stranger's
 *      name, and Explore still one press away at 375 and at 1440.
 *   4. FOCUS RETURNS TO THE CONTROL THAT WAS PRESSED, not to its hidden twin.
 *      Every opener exists twice and `display: none` decides which is real —
 *      the exact defect jsdom cannot see, because it gives every element a box.
 *   5. nothing overflows sideways and nothing clips, at any width, including a
 *      competition name far too long for a 264px rail;
 *   6. every control clears the 44px target the tokens promise;
 *   7. the two REAL pages — the Gold Standard Home and the Stage 7 Match
 *      Predictor — sit inside the new chrome without being crushed by it.
 *
 * THE BROWSER IS THE WRONG SIZE ON PURPOSE. The page opens at 1280×900, which
 * is the width and height of no frame under review, so anything inside a frame
 * that measures the window produces a number that cannot be mistaken for right.
 */

/** The band each width belongs to, which decides which navigation is real. */
const WIDTHS = [
  { story: 'four-375', width: 375, height: 812, navigation: 'bar' },
  { story: 'four-430', width: 430, height: 900, navigation: 'bar' },
  { story: 'four-768', width: 768, height: 1024, navigation: 'bar' },
  { story: 'four-1024', width: 1024, height: 768, navigation: 'bar' },
  { story: 'four-1440', width: 1440, height: 900, navigation: 'rail' },
  { story: 'four-1920', width: 1920, height: 1080, navigation: 'rail' },
] as const

/** Every world, at the two widths the composition differs most between. */
const WORLDS = [
  { story: 'one-375', label: 'one competition at 375', width: 375 },
  { story: 'one-430', label: 'one competition at 430', width: 430 },
  { story: 'one-768', label: 'one competition at 768', width: 768 },
  { story: 'one-1024', label: 'one competition at 1024', width: 1024 },
  { story: 'one-1440', label: 'one competition at 1440', width: 1440 },
  { story: 'one-1920', label: 'one competition at 1920', width: 1920 },
  { story: 'many-375', label: 'twelve competitions at 375', width: 375 },
  { story: 'many-1440', label: 'twelve competitions at 1440', width: 1440 },
  { story: 'many-1920', label: 'twelve competitions at 1920', width: 1920 },
  { story: 'platform-375', label: 'twenty published at 375', width: 375 },
  { story: 'platform-1440', label: 'twenty published at 1440', width: 1440 },
  { story: 'quiet-375', label: 'a quiet day at 375', width: 375 },
  { story: 'quiet-1440', label: 'a quiet day at 1440', width: 1440 },
  { story: 'live-1440', label: 'live elsewhere at 1440', width: 1440 },
  { story: 'none-375', label: 'no competitions at 375', width: 375 },
  { story: 'none-1440', label: 'no competitions at 1440', width: 1440 },
  { story: 'unsupported-375', label: 'an unsupported game at 375', width: 375 },
  { story: 'unsupported-1440', label: 'an unsupported game at 1440', width: 1440 },
  { story: 'long-375', label: 'long names at 375', width: 375 },
  { story: 'long-430', label: 'long names at 430', width: 430 },
  { story: 'long-1440', label: 'long names at 1440', width: 1440 },
  { story: 'long-1920', label: 'long names at 1920', width: 1920 },
] as const

/** The two accepted pages, inside the new chrome. */
const PAGES = [
  { story: 'home-one-375', label: 'Home, one competition at 375', width: 375 },
  { story: 'home-one-1440', label: 'Home, one competition at 1440', width: 1440 },
  { story: 'home-four-375', label: 'Home, four competitions at 375', width: 375 },
  { story: 'home-four-1440', label: 'Home, four competitions at 1440', width: 1440 },
  { story: 'home-four-1920', label: 'Home, four competitions at 1920', width: 1920 },
  { story: 'predictor-one-375', label: 'the predictor, one competition at 375', width: 375 },
  { story: 'predictor-one-1440', label: 'the predictor, one competition at 1440', width: 1440 },
  { story: 'predictor-four-375', label: 'the predictor, four competitions at 375', width: 375 },
  { story: 'predictor-four-1440', label: 'the predictor, four competitions at 1440', width: 1440 },
  { story: 'predictor-four-1920', label: 'the predictor, four competitions at 1920', width: 1920 },
] as const

type Reading = {
  frameWidth: number
  frameHeight: number
  horizontalOverflow: number
  /** Named landmarks that are actually rendered, in document order. */
  navigationLabels: string[]
  /** `bar` or `rail`, decided by where the one primary navigation actually sits. */
  navigationShape: 'bar' | 'rail' | 'none'
  currentDestinations: string[]
  destinationLabels: string[]
  smallTargets: string[]
  mainCount: number
  headingCount: number
  headingText: string | null
  /** Whether `<main aria-labelledby>` resolves to the page's own `h1`. */
  headingIsWired: boolean
  /** The content region's own width. The shell adds no inline padding to it. */
  mainWidth: number
  /**
   * EVERY PIXEL THE PLAYER CANNOT USE FOR FOOTBALL.
   *
   * The rail's area plus the masthead's plus the bottom bar's. This is the
   * number the whole scalability argument turns on, and it must not be a
   * function of how many competitions the PLATFORM has published.
   */
  chromeArea: number
  railWidth: number
  mastheadHeight: number
  /** Competition rows permanently on screen. Bounded, or it is a logo wall. */
  shortcutRows: number
  /** Whether a switcher CONTROL — not a label — is rendered. */
  switcherIsControl: boolean
  switcherIsLabel: boolean
  exploreControls: number
  attentionControls: number
  jumpControls: number
  /** All permanent chrome text, for "no stranger's name here" assertions. */
  chromeText: string
  clipped: string[]
  /** Destination labels whose text escapes the target it belongs to. */
  spillingLabels: string[]
  /** The gap between the last content the page drew and the bottom bar. */
  contentClearsBar: boolean
}

/**
 * ALL WIDTHS ARE `offsetWidth`, NEVER A CLIENT RECT.
 *
 * `WorkshopCanvas` fits several frames on one screen with a CSS transform, so
 * `getBoundingClientRect()` inside a frame shown at 62% returns 62% of the real
 * number. A transform does not change layout, and `offsetWidth` is the layout
 * box, so it is the width the page actually got. Only relative comparisons
 * within one frame use rects, where the scale cancels.
 *
 * Everything is scoped to the FIRST frame, because a story may board several
 * widths at once and each frame renders its own shell.
 */
async function read(page: import('@playwright/test').Page): Promise<Reading> {
  return page.evaluate<Reading>(() => {
    const root = document.querySelector('figure [data-vnext]')
    const scroller = root?.firstElementChild ?? null
    const shell = scroller?.querySelector('[data-vnext-shell]') ?? null
    const main = shell?.querySelector('main') ?? null
    const masthead = shell?.querySelector('[data-vnext-zone="masthead"]') ?? null
    const rail = shell?.querySelector('[data-vnext-shell-zone="rail"]') ?? null
    const rendered = (element: Element) => element.getClientRects().length > 0

    const visibleNavs = [...(shell?.querySelectorAll('nav') ?? [])].filter(rendered)
    const primaryNavs = visibleNavs.filter(
      (nav) => nav.getAttribute('aria-label') === 'Competition sections',
    )

    /**
     * WHICH SHAPE THE PRIMARY NAVIGATION IS, measured rather than read off a
     * class. The rail sits beside `<main>`; the bar is the last thing on the
     * page. A shell that rendered the bar inside the rail would still have
     * exactly one primary navigation and would still pass every count below.
     */
    let navigationShape: 'bar' | 'rail' | 'none' = 'none'
    const onlyNav = primaryNavs[0]
    if (primaryNavs.length === 1 && onlyNav && main) {
      navigationShape = rail?.contains(onlyNav)
        ? 'rail'
        : onlyNav.getBoundingClientRect().top >= main.getBoundingClientRect().top
          ? 'bar'
          : 'none'
    }

    const smallTargets: string[] = []
    for (const control of shell?.querySelectorAll('button, a[href]') ?? []) {
      if (!rendered(control)) continue
      // The skip link is a 1px clipped box UNTIL IT IS FOCUSED, at which point
      // its own rule gives it a 44px target. `clip-path` is the idiom that
      // hides it, and it is what separates "deliberately invisible" from "a
      // control a finger cannot hit".
      if (getComputedStyle(control).clipPath !== 'none') continue
      // `offsetWidth`/`offsetHeight` are layout boxes and ignore the CSS
      // transform the workshop uses to fit frames on one screen, so they are
      // the real size a finger would meet.
      const { offsetWidth, offsetHeight } = control as HTMLElement
      if (offsetHeight < 44 || offsetWidth < 44) {
        smallTargets.push(
          `${control.textContent?.trim().slice(0, 28) || '(icon)'} @ ${offsetWidth}x${offsetHeight}`,
        )
      }
    }

    const headings = [...(shell?.querySelectorAll('h1') ?? [])].filter(rendered)
    const labelledBy = main?.getAttribute('aria-labelledby') ?? null
    const mainWidth = (main as HTMLElement | null)?.offsetWidth ?? 0

    const box = (element: Element | null) => {
      if (!element || !rendered(element)) return { w: 0, h: 0 }
      const node = element as HTMLElement
      return { w: node.offsetWidth, h: node.offsetHeight }
    }
    const railBox = box(rail)
    const mastheadBox = box(masthead)
    const barBox = box(shell?.querySelector('[data-vnext-shell-zone="navbar"]') ?? null)

    const clipped: string[] = []
    for (const element of shell?.querySelectorAll<HTMLElement>('span, p, h1, kbd') ?? []) {
      if (!rendered(element)) continue
      const style = getComputedStyle(element)
      // The skip link is a 1px box holding a whole sentence, so it overflows by
      // design. `clip-path` is the idiom that hides it, and it is what
      // separates "deliberately invisible" from "accidentally cut off".
      if (style.clipPath !== 'none') continue
      if (style.overflowX !== 'hidden' && style.overflowX !== 'clip') continue
      if (element.scrollWidth - element.clientWidth > 1) {
        clipped.push(`"${element.textContent?.trim().slice(0, 36)}"`)
      }
    }

    /**
     * A LABEL THAT HAS LEFT ITS OWN TARGET.
     *
     * Not the same defect as clipping, and invisible to every other measurement
     * here: the text is not cut off, the frame does not scroll, and every target
     * still clears 44px — the words simply run through the control beside them.
     */
    const spillingLabels: string[] = []
    for (const nav of primaryNavs) {
      for (const control of nav.querySelectorAll('button')) {
        if (!rendered(control)) continue
        const target = control.getBoundingClientRect()
        for (const span of control.querySelectorAll('span')) {
          if (!rendered(span)) continue
          const text = span.getBoundingClientRect()
          if (text.left < target.left - 1 || text.right > target.right + 1) {
            spillingLabels.push(`"${span.textContent?.trim().slice(0, 24)}"`)
          }
        }
      }
    }

    /**
     * MOBILE CONTENT CLEARS THE BAR WITHOUT THE PAGE PAYING FOR IT.
     *
     * The bar is sticky and IN FLOW, so it reserves its own height at the END of
     * the document. A `fixed` bar would sit on top of the last thing the page
     * drew, and no other measurement here would notice.
     *
     * IT IS MEASURED AT THE BOTTOM OF THE SCROLL, which is the only place the
     * question means anything. Measured un-scrolled, every element below the
     * fold is "under the bar" — which is what scrolling is — and a tall page
     * like Home or the Match Predictor fails a check that is really asking
     * about the LAST thing on the page.
     */
    let contentClearsBar = true
    const bar = navigationShape === 'bar' ? primaryNavs[0] : null
    if (bar && main && scroller) {
      const restore = scroller.scrollTop
      scroller.scrollTop = scroller.scrollHeight
      const barTop = bar.getBoundingClientRect().top
      for (const element of main.querySelectorAll<HTMLElement>('*')) {
        if (!rendered(element)) continue
        if (element.children.length > 0) continue
        // Screen-reader-only text is a 1px absolutely-positioned box holding a
        // whole sentence — "You moved up 2 places" sits 250px below the bar by
        // design. `clip-path` is what separates deliberately invisible from
        // accidentally underneath.
        if (getComputedStyle(element).clipPath !== 'none') continue
        if (element.getBoundingClientRect().bottom > barTop + 1) contentClearsBar = false
      }
      scroller.scrollTop = restore
    }

    const chromeClone = shell?.cloneNode(true) as HTMLElement | null
    chromeClone?.querySelector('main')?.remove()
    chromeClone?.querySelector('[data-vnext-overlay]')?.remove()

    return {
      frameWidth: scroller?.clientWidth ?? 0,
      frameHeight: scroller?.clientHeight ?? 0,
      horizontalOverflow: scroller ? scroller.scrollWidth - scroller.clientWidth : -1,
      navigationLabels: visibleNavs.map(
        (nav) => nav.getAttribute('aria-label') ?? '(unnamed)',
      ),
      navigationShape,
      currentDestinations: primaryNavs.flatMap((nav) =>
        [...nav.querySelectorAll('[aria-current="page"]')].map(
          (item) => item.textContent?.trim() ?? '',
        ),
      ),
      destinationLabels: (primaryNavs[0]
        ? [...primaryNavs[0].querySelectorAll('button')]
        : []
      ).map((button) => button.textContent?.trim() ?? ''),
      smallTargets,
      mainCount: shell?.querySelectorAll('main').length ?? 0,
      headingCount: headings.length,
      headingText: headings[0]?.textContent?.trim() ?? null,
      headingIsWired: Boolean(
        labelledBy && document.getElementById(labelledBy) === headings[0],
      ),
      mainWidth,
      chromeArea:
        railBox.w * railBox.h +
        mastheadBox.w * mastheadBox.h +
        (navigationShape === 'bar' ? barBox.w * barBox.h : 0),
      railWidth: railBox.w,
      mastheadHeight: mastheadBox.h,
      shortcutRows: [
        ...(shell?.querySelectorAll('nav[aria-label="Your competitions"] button') ?? []),
      ].filter(rendered).length,
      switcherIsControl:
        [...(shell?.querySelectorAll('[data-vnext-switcher="control"]') ?? [])].filter(
          rendered,
        ).length > 0,
      switcherIsLabel:
        [...(shell?.querySelectorAll('[data-vnext-switcher="label"]') ?? [])].filter(
          rendered,
        ).length > 0,
      // BY ACCESSIBLE NAME AND NOT BY ONE ATTRIBUTE. The phone's Explore drops
      // its visible word at 375 and carries the name in `aria-label`; the
      // rail's says it in text. Counting only the attribute reported zero at
      // 1440 for a control that was plainly on screen.
      exploreControls: [...(shell?.querySelectorAll('button') ?? [])]
        .filter(rendered)
        .filter(
          (control) =>
            (control.getAttribute('aria-label') ?? control.textContent ?? '').trim() ===
            'Explore competitions',
        ).length,
      attentionControls: [
        ...(shell?.querySelectorAll('[data-vnext-attention="control"]') ?? []),
      ].filter(rendered).length,
      jumpControls: [
        ...(shell?.querySelectorAll('[data-vnext-jump="control"]') ?? []),
      ].filter(rendered).length,
      chromeText: (chromeClone?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      clipped,
      spillingLabels,
      contentClearsBar,
    }
  })
}

async function open(page: import('@playwright/test').Page, story: string) {
  await page.goto(`/iframe.html?id=vnext-shell--${story}&viewMode=story`, {
    waitUntil: 'load',
  })
  await page.waitForSelector('figure [data-vnext] [data-vnext-shell] main')
  // The masthead enters with a rise; measuring mid-entrance reads transformed
  // boxes rather than laid-out ones.
  await page.waitForTimeout(1200)
}

/** Every world owes the same baseline, whatever it is demonstrating. */
function expectShellBaseline(reading: Reading, where: string) {
  expect(reading.horizontalOverflow, `${where} scrolls sideways`).toBe(0)

  // ONE PRIMARY NAVIGATION, whichever shape it is. The other is `display: none`
  // and therefore out of the accessibility tree as well as off the page.
  expect(
    reading.navigationLabels.filter((label) => label === 'Competition sections'),
    `${where} should show exactly one primary navigation`,
  ).toHaveLength(1)
  expect(
    reading.currentDestinations.length,
    `${where} should mark exactly one current destination`,
  ).toBe(1)

  // Every navigation landmark is named. An unnamed one is indistinguishable
  // from the others to anyone listing landmarks.
  expect(
    reading.navigationLabels.filter((label) => label === '(unnamed)'),
    `${where} has an anonymous navigation landmark`,
  ).toEqual([])

  expect(reading.mainCount, `${where} should have exactly one main`).toBe(1)
  expect(reading.headingCount, `${where} should have exactly one h1`).toBe(1)
  expect(reading.headingIsWired, `${where} main is not labelled by its own h1`).toBe(true)
  expect(reading.smallTargets, `${where} has controls under 44px`).toEqual([])
  expect(reading.clipped, `${where} clips text`).toEqual([])
  expect(
    reading.spillingLabels,
    `${where} has a destination label sitting outside its own target`,
  ).toEqual([])
  expect(
    reading.contentClearsBar,
    `${where} draws page content underneath the bottom bar`,
  ).toBe(true)
}

/* ========================================================================== *
 * The bands
 * ========================================================================== */

test.describe('the shell holds its frame', () => {
  for (const width of WIDTHS) {
    test(`at ${width.width}px`, async ({ page }) => {
      await open(page, width.story)
      const reading = await read(page)
      const where = `the shell at ${width.width}px`

      // The frame is the frame, not the browser window. A `vh`/`vw` anywhere
      // inside would report 900/1280 here and could not be accidentally right.
      expect(reading.frameWidth, `${where} frame width`).toBe(width.width)
      expect(reading.frameHeight, `${where} frame height`).toBe(width.height)

      expectShellBaseline(reading, where)

      // THE SWAP, measured rather than read off a stylesheet. Below 1120 the
      // navigation is a bottom bar and the competition is a context bar above
      // the page; at 1120 and up it is a rail beside it.
      expect(reading.navigationShape, `${where} navigation shape`).toBe(width.navigation)

      expect(
        reading.destinationLabels.map((label) => label.replace(/\d+/g, '')),
        `${where} destinations`,
      ).toEqual(['Home', 'Matches', 'Games', 'Leagues'])
    })
  }
})

/* ========================================================================== *
 * Every world
 * ========================================================================== */

test.describe('the shell holds every world', () => {
  for (const world of WORLDS) {
    test(world.label, async ({ page }) => {
      await open(page, world.story)
      const reading = await read(page)
      expect(reading.frameWidth, `${world.label} frame width`).toBe(world.width)
      expectShellBaseline(reading, world.label)
    })
  }
})

/* ========================================================================== *
 * THE MEASUREMENT STAGE 7.6 EXISTS FOR
 * ========================================================================== */

test.describe('the platform may be large and the product must feel small', () => {
  test('does not grow the permanent chrome between one competition and twenty', async ({
    page,
  }) => {
    await open(page, 'one-1440')
    const one = await read(page)

    await open(page, 'four-1440')
    const four = await read(page)

    await open(page, 'platform-1440')
    const twenty = await read(page)

    await open(page, 'many-1440')
    const twelve = await read(page)

    // THE RAIL IS THE SAME WIDTH WHATEVER THE PLAYER HAS. A rail that widened
    // to fit the longest competition name would take the difference off the
    // football, and would do it silently.
    for (const [label, reading] of [
      ['four', four],
      ['twenty published', twenty],
      ['twelve', twelve],
    ] as const) {
      expect(
        reading.railWidth,
        `the rail is ${reading.railWidth}px at ${label} and ${one.railWidth}px at one`,
      ).toBe(one.railWidth)
      expect(
        reading.mainWidth,
        `the football column is ${reading.mainWidth}px at ${label} and ${one.mainWidth}px at one`,
      ).toBe(one.mainWidth)
    }

    // AND THE SHORTCUT LIST IS BOUNDED. Twelve competitions and twenty
    // published both stop at six rows; the remainder is a count.
    expect(one.shortcutRows, 'one competition needs no shortcut group').toBe(0)
    expect(four.shortcutRows).toBe(4)
    expect(twenty.shortcutRows, 'twenty published, three relevant').toBe(3)
    expect(twelve.shortcutRows, 'twelve competitions, six rows and a count').toBe(6)

    // THE CATALOGUE DOES NOT LEAK BEFORE DISCOVERY. Seventeen competitions the
    // player has not taken up are not named anywhere in the permanent chrome.
    for (const stranger of ['La Liga', 'Bundesliga', 'Eredivisie', 'Ligue 1']) {
      expect(
        twenty.chromeText,
        `${stranger} is in the catalogue, not in this player's chrome`,
      ).not.toContain(stranger)
    }
  })

  test('does not grow the phone’s chrome between one competition and twenty', async ({
    page,
  }) => {
    await open(page, 'one-375')
    const one = await read(page)
    await open(page, 'platform-375')
    const twenty = await read(page)

    // The context bar is ONE row whatever the player has: a switcher, Explore
    // and the account. Nothing about twenty published competitions may cost a
    // phone a pixel of football.
    expect(twenty.mastheadHeight).toBe(one.mastheadHeight)
    expect(twenty.chromeArea).toBe(one.chromeArea)
  })

  test('gives a one-competition player no chooser and still a way out', async ({
    page,
  }) => {
    for (const story of ['one-375', 'one-1440']) {
      await open(page, story)
      const reading = await read(page)

      expect(reading.switcherIsLabel, `${story}: the competition is a label`).toBe(true)
      expect(
        reading.switcherIsControl,
        `${story}: a control offering one choice is furniture`,
      ).toBe(false)
      expect(reading.shortcutRows, `${story}: nothing to switch within`).toBe(0)
      expect(reading.jumpControls, `${story}: no accelerator to learn`).toBe(0)
      expect(reading.attentionControls, `${story}: nothing waiting elsewhere`).toBe(0)

      // Discovery is a different job from switching, and it never disappears.
      expect(reading.exploreControls, `${story}: exactly one Explore`).toBe(1)
      expect(reading.chromeText).toContain('Premier League')
      for (const stranger of ['Scottish Premiership', 'Champions League', 'Euro 2028']) {
        expect(reading.chromeText, `${story}: ${stranger} does not belong here`)
          .not.toContain(stranger)
      }
    }
  })

  test('offers the accelerator only where the rail has stopped being complete', async ({
    page,
  }) => {
    await open(page, 'four-1440')
    expect((await read(page)).jumpControls, 'four competitions all fit the rail').toBe(0)

    await open(page, 'many-1440')
    expect((await read(page)).jumpControls, 'twelve do not').toBe(1)
  })

  test('says nothing at all on a quiet day', async ({ page }) => {
    for (const story of ['quiet-375', 'quiet-1440']) {
      await open(page, story)
      const reading = await read(page)
      expect(reading.attentionControls, `${story}: nothing is waiting`).toBe(0)
      expect(reading.chromeText.toLowerCase()).not.toContain('needs you')
    }
  })

  test('surfaces work waiting in another competition without leaving this one', async ({
    page,
  }) => {
    for (const story of ['four-375', 'four-1440']) {
      await open(page, story)
      const reading = await read(page)
      expect(reading.attentionControls, `${story}: exactly one attention control`).toBe(1)
      expect(reading.chromeText).toContain('need you elsewhere')
      // The current competition is still the root. The attention layer is a
      // strip, never the front door.
      expect(reading.chromeText).toContain('Premier League')
      expect(reading.currentDestinations).toEqual(['Home'])
    }
  })

  /**
   * ONE PRESS, AND IT LANDS IN THE RIGHT COMPETITION AND THE RIGHT GAME.
   *
   * The whole point of the layer. "Go and do this" is one intention, and a row
   * that changed the football context and left the player to find the game
   * would be the shell charging them for its own architecture.
   *
   * The story host renders the intent it received into the page header's
   * `context` slot as `<competition> · <game>`, and it resolves the competition
   * NAME by looking `intent.contextId` up in `contexts`. So this assertion also
   * proves the id round-tripped: a mapper that had joined on a display name
   * would put the wrong competition's name here, in a row that looked correct.
   */
  test('takes the player to the competition AND the game in one press', async ({
    page,
  }) => {
    await open(page, 'four-1440')

    // `:visible`, because EVERY OPENER EXISTS TWICE — a rail copy and a bar
    // copy, one of which is `display: none` at any width. `.first()` picks
    // whichever is earlier in the document, which at some widths is the hidden
    // one. The suite already records this twin as a real defect class.
    await page.locator('[data-vnext-attention="control"]:visible').first().click()
    const rows = page.locator('[role="dialog"] [data-urgency]')
    await rows.first().waitFor()

    // The urgent one first — `attentionElsewhere` orders by urgency, and the
    // world's urgent item is Euro 2028's Match Predictor, not the SPFL's
    // Championship, which is the one that appears first in the model's array.
    await expect(rows.first()).toContainText('Euro 2028')
    await expect(rows.first()).toContainText('Match Predictor')
    await rows.first().click()

    const header = page.locator('[data-vnext-shell] header')
    await expect(header).toContainText('Euro 2028 · Match Predictor')
    // The football context moved with it: the masthead now says the competition
    // the player was sent to, not the one they pressed from.
    await expect(header).not.toContainText('Premier League · 2026/27')
  })

  test('names the competition and the game apart on every row', async ({ page }) => {
    // The three dimensions rule, measured where it is visible. A row reading
    // "Euro 2028 Predictor" would be a competition and a game collapsed into
    // one thing, which is the failure the model exists to prevent.
    await open(page, 'four-375')
    await page.locator('[data-vnext-attention="control"]:visible').first().click()
    const rows = page.locator('[role="dialog"] [data-urgency]')
    await rows.first().waitFor()

    const boxes = await rows.evaluateAll((nodes) =>
      nodes.map((node) => {
        const context = node.querySelector('[class*="rowContext"]')
        const game = node.querySelector('[class*="rowGame"]')
        return {
          contextTop: context?.getBoundingClientRect().top ?? 0,
          gameTop: game?.getBoundingClientRect().top ?? 0,
          contextText: context?.textContent ?? '',
          gameText: game?.textContent ?? '',
        }
      }),
    )
    expect(boxes.length).toBeGreaterThan(0)
    for (const box of boxes) {
      // Two separate lines, not one run-together label.
      expect(box.gameTop).toBeGreaterThan(box.contextTop)
      expect(box.contextText.length).toBeGreaterThan(0)
      expect(box.gameText.length).toBeGreaterThan(0)
      // The competition's name does not appear inside the game line.
      expect(box.gameText).not.toContain(box.contextText)
    }
  })
})

/* ========================================================================== *
 * Focus, in a browser where `display: none` is real
 * ========================================================================== */

test.describe('focus behaves where a hidden twin exists', () => {
  test('returns focus to the switcher that was actually pressed, at 1440', async ({
    page,
  }) => {
    await open(page, 'four-1440')

    // THE DEFECT THIS MEASURES. Every opener exists twice — a rail copy and a
    // bar copy — and a shared ref holds whichever mounted last. Closing the
    // sheet on a desktop then focuses the phone's `display: none` control, the
    // browser refuses, and focus falls to `<body>` with no indication that
    // anything moved. jsdom cannot see it: it gives every element a box.
    const opener = page
      .locator('figure [data-vnext-shell] [data-vnext-switcher="control"]:visible')
      .first()
    await opener.click()

    const dialog = page.getByRole('dialog', { name: 'Choose a competition' })
    await expect(dialog).toBeVisible()

    // Focus ENTERED the overlay rather than staying behind it.
    expect(
      await page.evaluate(() =>
        document.querySelector('[data-vnext-overlay]')?.contains(document.activeElement),
      ),
    ).toBe(true)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)

    const focusReturned = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null
      return {
        isSwitcher: active?.getAttribute('data-vnext-switcher') === 'control',
        isVisible: (active?.getClientRects().length ?? 0) > 0,
      }
    })
    expect(focusReturned.isSwitcher, 'focus went back to a switcher').toBe(true)
    expect(focusReturned.isVisible, 'and to the one that is on screen').toBe(true)
  })

  test('returns focus to the switcher that was actually pressed, at 375', async ({
    page,
  }) => {
    await open(page, 'four-375')
    const opener = page
      .locator('figure [data-vnext-shell] [data-vnext-switcher="control"]:visible')
      .first()
    await opener.click()
    await expect(page.getByRole('dialog', { name: 'Choose a competition' })).toBeVisible()
    await page.keyboard.press('Escape')

    expect(
      await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null
        return (
          active?.getAttribute('data-vnext-switcher') === 'control' &&
          (active?.getClientRects().length ?? 0) > 0
        )
      }),
    ).toBe(true)
  })

  test('lets the keyboard reach Explore and the competition switcher', async ({
    page,
  }) => {
    await open(page, 'four-1440')
    // The skip link is the first stop, which is the whole point of moving it
    // ahead of the rail — a keyboard user at 1440 must not have to pass the
    // switcher, four destinations, four shortcuts, Explore and the account
    // before being offered a way past them.
    await page.keyboard.press('Tab')
    expect(
      await page.evaluate(() => document.activeElement?.textContent?.trim()),
    ).toBe('Skip to content')

    const reachable = await page.evaluate(() => {
      const shell = document.querySelector('figure [data-vnext-shell]')
      const rendered = (element: Element) => element.getClientRects().length > 0
      return [...(shell?.querySelectorAll('button, a[href]') ?? [])]
        .filter(rendered)
        .map((control) => control.getAttribute('aria-label') ?? control.textContent?.trim())
    })
    expect(reachable).toContain('Explore competitions')
    expect(reachable.some((name) => name?.includes('change competition'))).toBe(true)
  })

  test('opens Jump from the keyboard and never from inside a text field', async ({
    page,
  }) => {
    await open(page, 'many-1440')

    const jump = page.locator('figure [data-vnext-shell] [data-vnext-jump="control"]')
    await jump.focus()
    await page.keyboard.press('Control+k')
    const dialog = page.getByRole('dialog', { name: 'Jump to' })
    await expect(dialog).toBeVisible()

    // AND THE ACCELERATOR DOES NOT EAT THE PRODUCT. Focus is in Jump's own
    // search field; a second `Ctrl+K` there must type nothing and re-open
    // nothing, because the same shortcut inside the predictor's score boxes
    // would be the accelerator taking a keystroke off the game.
    await page.keyboard.press('Control+k')
    await expect(dialog).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.activeElement?.getAttribute('data-vnext-jump') === 'control',
      ),
    ).toBe(true)
  })

  test('groups Jump’s results and keeps the three dimensions apart', async ({ page }) => {
    await open(page, 'many-1440')
    await page.locator('figure [data-vnext-shell] [data-vnext-jump="control"]').click()

    const dialog = page.getByRole('dialog', { name: 'Jump to' })
    await expect(dialog.getByRole('list', { name: 'Competitions' })).toBeVisible()
    await expect(dialog.getByRole('list', { name: 'Games' })).toBeVisible()
    await expect(dialog.getByRole('list', { name: 'Leagues' })).toBeVisible()

    // A competition row and a game row are never in the same list.
    await expect(
      dialog.getByRole('list', { name: 'Competitions' }).getByRole('button', {
        name: /Match Predictor/,
      }),
    ).toHaveCount(0)
  })
})

/* ========================================================================== *
 * The two real pages
 * ========================================================================== */

test.describe('the shell hosts the accepted pages', () => {
  for (const entry of PAGES) {
    test(entry.label, async ({ page }) => {
      await open(page, entry.story)
      const reading = await read(page)
      expect(reading.frameWidth, `${entry.label} frame width`).toBe(entry.width)
      expectShellBaseline(reading, entry.label)
      // The competition is stated by the CHROME and the page's own `h1` says
      // what the page is. Neither repeats the other.
      expect(reading.chromeText).toContain('Premier League')
      expect(reading.headingText).not.toBe('Premier League')
    })
  }

  test('does not crush the predictor’s mobile entry', async ({ page }) => {
    await open(page, 'predictor-four-375')

    const measurement = await page.evaluate(() => {
      const shell = document.querySelector('figure [data-vnext-shell]')
      const main = shell?.querySelector('main') as HTMLElement | null
      const inputs = [...(main?.querySelectorAll<HTMLInputElement>('input') ?? [])].filter(
        (input) => input.getClientRects().length > 0,
      )
      return {
        mainWidth: main?.offsetWidth ?? 0,
        inputCount: inputs.length,
        smallest: Math.min(...inputs.map((input) => input.offsetHeight)),
      }
    })

    // At 375 the shell is a masthead and a bar; the score boxes get the whole
    // width and the whole target. A shell that had taken a column here would
    // show up as a narrower `<main>` than the frame.
    expect(measurement.mainWidth).toBe(375)
    expect(measurement.inputCount).toBeGreaterThan(4)
    expect(measurement.smallest).toBeGreaterThanOrEqual(44)
  })

  test('leaves the predictor its two-across working column at 1920', async ({ page }) => {
    await open(page, 'predictor-four-1920')

    const measurement = await page.evaluate(() => {
      const shell = document.querySelector('figure [data-vnext-shell]')
      const rail = shell?.querySelector('[data-vnext-shell-zone="rail"]')
      const main = shell?.querySelector('main') as HTMLElement | null
      const rows = [...(main?.querySelectorAll<HTMLElement>('ol > li') ?? [])].filter(
        (row) => row.getClientRects().length > 0,
      )
      return {
        railWidth: (rail as HTMLElement | null)?.offsetWidth ?? 0,
        mainWidth: main?.offsetWidth ?? 0,
        columns: new Set(rows.map((row) => Math.round(row.getBoundingClientRect().left)))
          .size,
      }
    })

    // The rail costs 264px and the predictor still lays two fixtures across —
    // the measurement that would catch a rail grown greedy.
    expect(measurement.railWidth).toBe(264)
    expect(measurement.mainWidth).toBe(1920 - 264)
    expect(measurement.columns).toBeGreaterThanOrEqual(2)
  })
})

/* ========================================================================== *
 * Reduced motion
 * ========================================================================== */

test.describe('reduced motion', () => {
  test('is the same shell with the travel removed', async ({ page }) => {
    await open(page, 'reduced-motion')
    const reading = await read(page)
    expectShellBaseline(reading, 'the shell under reduced motion')

    // Nothing is LOST under reduced motion — the same controls, the same words.
    expect(reading.chromeText).toContain('Premier League')
    expect(reading.attentionControls).toBe(1)
  })
})

/**
 * `UX-007` — WCAG 2.2 AA 2.4.11, FOCUS NOT OBSCURED (MINIMUM).
 *
 * ============================ WHY IT IS AT THE END AND ON ITS OWN STORY ==
 *
 * Every case above opens a WORKSHOP story, which puts the surface in a device
 * frame. A framed surface scrolls inside the frame, so the scroll container is
 * the frame element and `scroll-padding` on the document does nothing to it —
 * which is exactly why the risk register recorded the first probe written for
 * this as unreliable and refused to carry it as evidence.
 *
 * `vNext/Focus Not Obscured` is one real page in one `VNextRoot` with no frame,
 * `layout: 'fullscreen'`, so the iframe's own document is the scroller — the
 * shape production has, because `VNextRoot` uses `overflow-x: clip` rather than
 * `hidden` precisely so the document scrolls and the masthead sticks to the
 * viewport.
 *
 * ============================ WHAT IT MEASURES ==========================
 *
 * It tabs. Not `focus()` — a scripted focus does not necessarily scroll, and
 * the defect is entirely about where the browser scrolls to. After each stop it
 * asks the same question the criterion asks: is any part of the focused control
 * still visible, or has author-created content covered it? Both sticky bars are
 * checked, because the phone has one at each end.
 */
test.describe('focus is never hidden under the sticky chrome', () => {
  for (const frame of [
    { width: 375, height: 720, where: 'a phone, where the bottom bar is real too' },
    { width: 1440, height: 900, where: 'a desktop, where the rail replaces it' },
  ]) {
    test(`keeps every keyboard stop visible on ${frame.where}`, async ({ page }) => {
      await page.setViewportSize({ width: frame.width, height: frame.height })
      await page.goto('/iframe.html?id=vnext-focus-not-obscured--predictor&viewMode=story', {
        waitUntil: 'load',
      })
      await page.waitForSelector('[data-vnext] [data-vnext-shell] main')
      // The masthead enters with a rise; measuring mid-entrance reads a
      // transformed box rather than a laid-out one.
      await page.waitForTimeout(1200)

      // THE CORRECTION IS ON THE SCROLLER, which is the document. Asserted
      // first so a failure below can be read as "the padding is wrong" rather
      // than "the padding is missing".
      const padding = await page.evaluate(() =>
        getComputedStyle(document.documentElement).scrollPaddingBlockStart,
      )
      expect(padding, 'the document scroller has no top scroll padding').not.toBe('auto')
      expect(parseFloat(padding)).toBeGreaterThan(0)

      const obscured: string[] = []

      // Enough stops to walk out of the masthead, through the shell's controls
      // and well down the fixture column, which is where the defect appears.
      for (let step = 0; step < 60; step += 1) {
        await page.keyboard.press('Tab')
        const finding = await page.evaluate(() => {
          const active = document.activeElement as HTMLElement | null
          if (!active || active === document.body) return null

          const box = active.getBoundingClientRect()
          if (box.width === 0 && box.height === 0) return null

          /**
           * HIT-TESTED, NOT RECTANGLE ARITHMETIC.
           *
           * Comparing boxes was the first version of this probe and it reported
           * the skip link and the rail's switcher as covered — both sit in the
           * masthead's vertical BAND and neither is under it, one because it
           * paints above and one because it is beside. Which is presumably how
           * the first attempt at this measurement came to be recorded as
           * unreliable.
           *
           * `elementFromPoint` asks the question the criterion actually asks:
           * at this point on the screen, what would the player's finger hit?
           * 2.4.11 (Minimum) is satisfied while ANY part of the control is
           * hittable, so five points are sampled and one is enough.
           */
          const inset = 2
          const points: [number, number][] = [
            [box.left + inset, box.top + inset],
            [box.right - inset, box.top + inset],
            [box.left + inset, box.bottom - inset],
            [box.right - inset, box.bottom - inset],
            [box.left + box.width / 2, box.top + box.height / 2],
          ]

          const visible = points.some(([x, y]) => {
            if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false
            const top = document.elementFromPoint(x, y)
            return top !== null && (top === active || active.contains(top) || top.contains(active))
          })
          if (visible) return null

          const label =
            active.getAttribute('aria-label') ??
            active.textContent?.trim().slice(0, 40) ??
            active.tagName

          // WHICH PIECE OF CHROME, so a failure names the thing to fix rather
          // than only the thing that broke.
          const blocker = document.elementFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          )
          const zone =
            blocker?.closest('[data-vnext-zone="masthead"]') !== null
              ? 'the masthead'
              : blocker?.closest('[data-vnext-shell-zone="navbar"]') !== null
                ? 'the bottom bar'
                : 'author content'

          return `${label} is hidden under ${zone}`
        })
        if (finding) obscured.push(`${step}: ${finding}`)
      }

      expect(obscured, `${frame.where}: focus was hidden under sticky chrome`).toEqual([])
    })
  }
})
