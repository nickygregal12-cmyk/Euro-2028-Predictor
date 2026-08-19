import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { VNextLms, type LmsNotice } from '../../src/vnext/lms/VNextLms'
import { VNextRoot } from '../../src/vnext/foundations/VNextRoot'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { lmsScenarioNames, lmsScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { LmsPageModel } from '../../src/vnext/models/lms'

/**
 * WHAT IS WORTH GUARDING ABOUT THE STAGE 11 SURFACE.
 *
 * Composition, target sizes and overflow are measured in a real browser by
 * `e2e/vnext-lms.spec.ts`. What is held here is the set of promises that must
 * survive any redesign:
 *
 *   1. A CLUB IS PRESSABLE IFF THE MODEL SAID SO. Used, chosen and shut clubs
 *      are TEXT — not disabled buttons — and the press emits the id the option
 *      carried, never one read from somewhere else.
 *   2. SURVIVAL IS THE STANDING, NEVER THE RESULT. A won pick beside an
 *      elimination must read as an elimination.
 *   3. THERE IS NO SCORE ANYWHERE. This is not Match Predictor, and the
 *      clearest structural proof is that the page has no numeric input at all.
 *   4. THE DEADLINE IS SAID, NOT COUNTED.
 *   5. NOT-OFFERED, NOT-ENTERED, NO-ROUND and UNAVAILABLE are four sentences.
 *   6. A WRITE THAT DID NOT LAND SAYS WHICH KIND IT WAS.
 *   7. One `<main>`, one `<h1>`, and the accessibility floor, in every world.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

async function scan(ui: ReactElement) {
  const { unmount } = render(ui)
  try {
    const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } })
    const failing = [
      ...results.violations,
      ...results.incomplete.filter((result) => !JSDOM_CANNOT_EVALUATE.has(result.id)),
    ].filter((result) => result.impact && FAIL_IMPACTS.has(result.impact))

    expect(
      failing,
      failing.map((v) => `${v.id} (${v.impact}): ${v.help}`).join('\n'),
    ).toEqual([])
  } finally {
    unmount()
  }
}

function renderLms(
  model: LmsPageModel,
  options: {
    onIntent?: (intent: { kind: 'pick'; teamId: string }) => void
    onRetry?: () => void
    busy?: boolean
    notice?: LmsNotice
  } = {},
) {
  return render(
    <VNextRoot>
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextLms
          model={model}
          onIntent={options.onIntent}
          onRetry={options.onRetry}
          busy={options.busy}
          notice={options.notice}
        />
      </VNextShellProvider>
    </VNextRoot>,
  )
}

function zone(name: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-vnext-zone="${name}"]`)
  if (found === null) throw new Error(`no zone "${name}"`)
  return found
}

/* ------------------------------------------------------------------ *
 * 1. A club is pressable iff the model said so
 * ------------------------------------------------------------------ */

describe('a club is pressable only where the model carried an id', () => {
  it('gives a pickable club a button and a used one plain text', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })

    expect(screen.getByRole('button', { name: 'Celtic' })).toBeTruthy()
    // Hearts is spent: present, legible, and not a control.
    expect(screen.queryByRole('button', { name: /Hearts/ })).toBeNull()
    expect(within(zone('pick-list')).getByText('Hearts')).toBeTruthy()
  })

  it('offers no control at all once the round is locked', () => {
    renderLms(lmsScenarios.lockedRound, { onIntent: vi.fn() })
    expect(within(zone('pick-list')).queryAllByRole('button')).toEqual([])
  })

  it('offers no control to an eliminated player', () => {
    renderLms(lmsScenarios.eliminated, { onIntent: vi.fn() })
    expect(within(zone('pick-list')).queryAllByRole('button')).toEqual([])
  })

  it('marks the held club rather than offering it again', () => {
    renderLms(lmsScenarios.pickMade, { onIntent: vi.fn() })
    expect(screen.queryByRole('button', { name: /Celtic/ })).toBeNull()
    expect(within(zone('pick-list')).getByText('Your pick')).toBeTruthy()
  })

  it('emits the id the option carried', async () => {
    const onIntent = vi.fn()
    renderLms(lmsScenarios.openRound, { onIntent })

    await userEvent.click(screen.getByRole('button', { name: 'Celtic' }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'pick', teamId: 'team-celtic' })
  })

  it('offers nothing to press when the host wired no intent', () => {
    renderLms(lmsScenarios.openRound)
    expect(within(zone('pick-list')).queryAllByRole('button')).toEqual([])
  })

  it('never renders a disabled club control', () => {
    // A disabled button advertises something the player cannot have and invites
    // the press anyway. Everywhere a club cannot be picked it is text.
    for (const name of lmsScenarioNames) {
      const { unmount } = renderLms(lmsScenarios[name], { onIntent: vi.fn() })
      const disabled = [...document.querySelectorAll('button[disabled]')].filter(
        (node) => !(node.textContent ?? '').includes('Try again'),
      )
      expect(disabled, `${name} renders a disabled club`).toEqual([])
      unmount()
    }
  })

  it('waits rather than queueing a second pick while one is in flight', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn(), busy: true })
    const celtic = screen.getByRole('button', { name: 'Celtic' })
    expect(celtic).toHaveProperty('disabled', true)
  })
})

/* ------------------------------------------------------------------ *
 * 2. Survival is the standing
 * ------------------------------------------------------------------ */

describe('survival is the standing, never the result', () => {
  it('says eliminated even though the picked club won', () => {
    renderLms(lmsScenarios.wonButEliminated)

    expect(zone('standing').textContent).toContain('You have been eliminated')
    // The club's result is still shown as the fact it is.
    expect(document.body.textContent).toContain('Celtic')
  })

  it('says still in even though the picked club lost', () => {
    renderLms(lmsScenarios.lostButAlive)
    expect(zone('standing').textContent).toContain('You are still in')
  })

  it('does not read a postponed pick as bad news', () => {
    renderLms(lmsScenarios.postponedPick)
    expect(zone('standing').textContent).toContain('You are still in')
  })

  it('says nothing about a standing the page does not have', () => {
    renderLms(lmsScenarios.notEntered)
    expect(document.querySelector('[data-vnext-zone="standing"]')).toBeNull()
  })

  it('names the champion', () => {
    renderLms(lmsScenarios.champion)
    expect(zone('standing').textContent).toContain('last one standing')
  })
})

/* ------------------------------------------------------------------ *
 * 3. It is not Match Predictor
 * ------------------------------------------------------------------ */

describe('it is a choice, not a form', () => {
  it('has no numeric input anywhere, in any world', () => {
    // THE STRUCTURAL DIFFERENCE. Match Predictor takes a score on every
    // fixture; this takes one club and no numbers at all.
    for (const name of lmsScenarioNames) {
      const { unmount } = renderLms(lmsScenarios[name], { onIntent: vi.fn() })
      expect(document.querySelectorAll('input'), `${name} has an input`).toHaveLength(0)
      unmount()
    }
  })

  it('prints no scoreline in the pick list', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    expect(zone('pick-list').textContent).not.toMatch(/\d\s*[–-]\s*\d/)
  })

  it('says what the game costs, in one line', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    expect(document.body.textContent).toContain('You cannot use it again')
  })
})

/* ------------------------------------------------------------------ *
 * 4. The deadline is said, not counted
 * ------------------------------------------------------------------ */

describe('the deadline is said rather than counted', () => {
  it('prints when picks close for an open round', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    expect(zone('round').textContent).toContain('Picks close')
  })

  it('prints when they closed for a locked one', () => {
    renderLms(lmsScenarios.lockedRound)
    expect(zone('round').textContent).toContain('Picks closed')
  })

  it('says there is no deadline rather than inventing one', () => {
    // THE ABSENT DEADLINE IS THE HEADLINE, even though this round has also not
    // opened. "Picks open 12:00" would imply picking becomes possible; what a
    // player needs to know is that no closing time exists yet.
    renderLms(lmsScenarios.unscheduled)
    expect(zone('round').textContent).toContain('No deadline set yet')
    expect(zone('round').textContent).not.toContain('Picks close')
    expect(zone('round').textContent).not.toContain('Picks open')
  })

  it('never tells a player picks CLOSED on a round that has not OPENED', () => {
    // The browser suite caught this: two branches, open or else closed, made a
    // round that had not started announce "Picks closed 11:00" — a deadline the
    // player is told they missed and which has not arrived.
    renderLms(lmsScenarios.notOpenYet)
    expect(zone('round').textContent).not.toContain('Picks closed')
    expect(zone('round').textContent).toContain('Picks open')
  })
})

/* ------------------------------------------------------------------ *
 * 5–6. Four sentences, and three write outcomes
 * ------------------------------------------------------------------ */

describe('four different sentences about four different subjects', () => {
  it('says the competition does not run this game', () => {
    renderLms(lmsScenarios.notOffered)
    expect(document.body.textContent).toContain('does not run Last Man Standing')
  })

  it('says the player has not entered, and offers no join door', () => {
    renderLms(lmsScenarios.notEntered)
    expect(document.body.textContent).toContain('not entered')
    // Stage 11 does not own entry; a button here would be a door onto a
    // corridor that has not been built.
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull()
  })

  it('says there is no round right now', () => {
    renderLms(lmsScenarios.noRound)
    expect(document.body.textContent).toContain('no round to play')
  })

  it('says the read did not answer, and only that one offers a retry', () => {
    const onRetry = vi.fn()
    const failed = renderLms(lmsScenarios.unavailable, { onRetry })
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    // UNMOUNTED BEFORE THE LOOP. `screen` queries the whole document, so a
    // render left standing would answer for the world being checked next.
    failed.unmount()

    for (const name of ['notOffered', 'notEntered', 'noRound', 'lockedRound'] as const) {
      const { unmount } = renderLms(lmsScenarios[name], { onRetry })
      expect(screen.queryByRole('button', { name: 'Try again' }), name).toBeNull()
      unmount()
    }
  })
})

describe('a write that did not land says which kind it was', () => {
  it('tells a conflict from a refusal from a fault', () => {
    const conflict = renderLms(lmsScenarios.openRound, { notice: { kind: 'conflict' } })
    expect(document.body.textContent).toContain('changed somewhere else')
    conflict.unmount()

    const refused = renderLms(lmsScenarios.openRound, {
      notice: { kind: 'refused', reason: 'You have already used that club in this cycle. Pick another.' },
    })
    expect(document.body.textContent).toContain('already used that club')
    refused.unmount()

    renderLms(lmsScenarios.openRound, { notice: { kind: 'failed' } })
    expect(document.body.textContent).toContain('Nothing has changed')
  })

  /**
   * THE SENTENCE THAT MAY ONLY EVER APPEAR ON A FAULT.
   *
   * "Nothing has changed, so you can try again" is a claim about the SERVER,
   * and it is true only of a write that never landed. It was once shown for
   * refusals too — where both halves were false and the retry it invited could
   * never succeed, because a club spent is spent. That defect reached this
   * surface through a second refusal classifier in the hook that knew one code
   * out of five; the classifier is gone, and this pins the copy.
   */
  it('never tells a player nothing changed when the server refused on a rule', () => {
    const refusals = [
      'You have already used that club in this cycle. Pick another.',
      'You have been eliminated, so you cannot pick in this round.',
      'That round is no longer available. Reload to see the current one.',
    ]
    for (const reason of refusals) {
      const { unmount } = renderLms(lmsScenarios.openRound, {
        notice: { kind: 'refused', reason },
      })
      expect(document.body.textContent, reason).toContain(reason)
      expect(document.body.textContent, reason).not.toContain('Nothing has changed')
      unmount()
    }
  })

  it('announces it to a reader who cannot see it', () => {
    renderLms(lmsScenarios.openRound, { notice: { kind: 'conflict' } })
    const status = screen.getAllByRole('status')
    expect(status.some((node) => /changed somewhere else/.test(node.textContent ?? ''))).toBe(true)
  })

  it('says nothing at all when the last pick landed', () => {
    renderLms(lmsScenarios.pickMade, { onIntent: vi.fn() })
    expect(document.body.textContent).not.toContain('changed somewhere else')
    expect(document.body.textContent).not.toContain('could not save')
  })
})

/* ------------------------------------------------------------------ *
 * 7. Structure and the accessibility floor
 * ------------------------------------------------------------------ */

/**
 * EVERY WORLD MUST BE A STATE THE MAPPER CAN ACTUALLY PRODUCE.
 *
 * Stage 10 shipped a fixture pairing two figures the real read never emits
 * together, and four layers of tests passed against it because every layer
 * trusted the fixture. This is the structural version of that lesson: the
 * pairing rules `buildLmsModel` enforces are asserted over EVERY world at once,
 * so a new world cannot be added in an impossible state.
 */
describe('no world describes a page the mapper could not build', () => {
  it.each(lmsScenarioNames)('%s pairs its body and its field lawfully', (name) => {
    const world = lmsScenarios[name]

    // CONTRACT 164'S DISCLOSURE BOUNDARY IS ENTRANCY. A caller who is not
    // entered, or a season not running the game, is returned `field: null` —
    // so they cannot learn the competition's size without joining. A world
    // showing "83 still in" beside "you are not entered" is unreachable.
    if (world.body.kind === 'not-entered' || world.body.kind === 'not-offered') {
      expect(world.field.kind).toBe('not-counted')
    }

    // `picked` IS WITHHELD UNTIL THE ROUND LOCKS. `lms_round_revealed` is
    // `locks_at <= now()`, the same boundary `LmsRoundState` reports — so a
    // number here beside an open round is a world the server cannot emit.
    if (world.field.kind === 'field' && world.field.counts.picked !== null) {
      expect(world.body.kind).toBe('round')
      if (world.body.kind === 'round') {
        expect(['locked', 'settled']).toContain(world.body.round.state)
      }
    }

    // A PLAYER WHO IS NOT ENTERED HAS NO STANDING, and vice versa: the standing
    // is the entry outcome, and `entered` is that row existing at all.
    if (world.body.kind === 'not-entered') expect(world.standing).toBeNull()

    if (world.body.kind === 'round') {
      const options = world.body.round.choices.flatMap((c) => [c.home, c.away])

      // THE USED LIST IS BUILT FROM THIS ROUND'S FIXTURES AND FROM NOTHING
      // ELSE. `buildLmsModel` filters `club.used` over `page.fixtures`, so a
      // name in the list that plays in no fixture here is a name the mapper
      // cannot produce.
      const names = options.map((o) => o.name)
      for (const used of world.usedClubNamesInRound) {
        expect(names, `"${used}" is spent but plays in no fixture here`).toContain(used)
      }

      // AND A CLUB THE PLAYER MAY STILL PICK IS NOT A SPENT ONE. One flag,
      // `club.used`, decides both the action and the name list, so it cannot
      // say two things about one club.
      for (const option of options) {
        if (option.action.kind === 'pick' || option.action.kind === 'chosen') {
          expect(world.usedClubNamesInRound, option.name).not.toContain(option.name)
        }
      }

      // WHERE NOTHING BLOCKS THE ROUND, the two readings must agree exactly:
      // a spent club shows `used`, and the list is those clubs. In a BLOCKED
      // round they cannot be compared this way — `actionFor` returns
      // `unavailable` for every club before it ever looks at `used` — so the
      // subset and disjointness rules above are the whole of what holds.
      const blocked = options.some((o) => o.action.kind === 'unavailable')
      if (!blocked) {
        const spent = options.filter((o) => o.action.kind === 'used').map((o) => o.name)
        expect([...world.usedClubNamesInRound].sort()).toEqual([...spent].sort())
      }

      // A ROUND IS `settled` BECAUSE THE ROUND SETTLED, and `postponed` is not
      // a settlement — `lms_outcome_from_fixture` returns it for any fixture
      // that has not been played, so a picked club before kick-off carries it.
      if (world.body.pick?.result === 'postponed') {
        expect(world.body.round.state).not.toBe('settled')
      }
    }

    // THE POOL COUNTS SUM, because `bonus_competition_entrants.outcome` is
    // `not null` and contract 164 counts `= 'eliminated'` and `<> 'eliminated'`
    // over the same rows. A world where they did not sum would be a page the
    // database cannot produce.
    if (world.field.kind === 'field') {
      const { entrants, remaining, eliminated } = world.field.counts
      expect(remaining + eliminated, 'the pool counts must sum').toBe(entrants)
      if (world.field.counts.picked !== null) {
        expect(world.field.counts.picked).toBeLessThanOrEqual(entrants)
      }
    }
  })
})

describe('every world is one page', () => {
  it.each(lmsScenarioNames)('%s has one main and one h1', (name) => {
    renderLms(lmsScenarios[name], { onIntent: vi.fn() })
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('lists the clubs already spent', () => {
    renderLms(lmsScenarios.manyUsed, { onIntent: vi.fn() })
    expect(zone('used').textContent).toContain('Hearts')
    expect(zone('used').textContent).toContain('Motherwell')
  })

  /**
   * THE HEADING MAY NOT CLAIM COMPLETENESS IT DOES NOT HAVE.
   *
   * `usedClubNamesInRound` can only name used clubs PLAYING THIS ROUND —
   * contract 116 gives the whole cycle list as ids, and club names only for
   * this round's fixtures. A heading reading "Clubs you have already used"
   * would under-report exactly the clubs a player has most likely forgotten,
   * and no amount of correct markup would make it true.
   */
  it('bounds the used heading to this round rather than claiming the cycle', () => {
    renderLms(lmsScenarios.manyUsed, { onIntent: vi.fn() })
    const heading = zone('used').querySelector('h2')?.textContent ?? ''
    expect(heading).toContain('in this round')
    expect(heading).not.toMatch(/^Clubs you have already used$/)
  })

  /* ---------------------------------------------------------------- *
   * The field: carried, never counted, and its nulls kept
   * ---------------------------------------------------------------- */

  it('states the three pool counts without implying they add up', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    const field = zone('field').textContent ?? ''
    expect(field).toContain('83 still in')
    expect(field).toContain('37 out')
    expect(field).toContain('120 entered')
    // NOT "83 of 120": in contract 164 a NULL outcome is counted in neither
    // `remaining` nor `eliminated`, so the figures need not sum to `entrants`
    // and a fraction would read as a whole the database never agreed to.
    expect(field).not.toContain('83 of 120')
  })

  it('says the picked count is withheld rather than printing a zero', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    const field = zone('field').textContent ?? ''
    expect(field).toContain('hidden until picks close')
    // THE DEFECT THIS FORBIDS: `picked ?? 0` rendering "0 players picked" —
    // a confident claim about rivals the server deliberately refused to make.
    expect(field).not.toContain('0 players picked')
  })

  it('shows the picked count once the round has locked and the server discloses it', () => {
    renderLms(lmsScenarios.fieldRevealed, { onIntent: vi.fn() })
    const field = zone('field').textContent ?? ''
    expect(field).toContain('79 players picked')
    expect(field).not.toContain('hidden until picks close')
  })

  it('states the organiser`s rules and never applies them', () => {
    renderLms(lmsScenarios.fieldWithLives, { onIntent: vi.fn() })
    expect(zone('rules').textContent).toContain('2 lives')
    expect(zone('rules').textContent).toContain('1 save')
    expect(zone('rules').textContent).toContain('A draw survives')
  })

  it('gets the singular right for one life and no saves', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    const rules = zone('rules').textContent ?? ''
    expect(rules).toContain('1 life')
    expect(rules).not.toContain('1 lives')
    expect(rules).toContain('no saves')
    expect(rules).not.toContain('0 saves')
  })

  it('renders no rules at all when the organiser wrote none', () => {
    renderLms(lmsScenarios.fieldWithoutRules, { onIntent: vi.fn() })
    // ABSENT, not zeroed. "0 lives" would describe a harsher game than the
    // real one, and nobody chose it.
    expect(document.querySelector('[data-vnext-zone="rules"]')).toBeNull()
    expect(zone('field').textContent).not.toContain('0 lives')
  })

  it('keeps the round pickable when only the field read failed', () => {
    renderLms(lmsScenarios.fieldUnavailable, { onIntent: vi.fn() })
    expect(document.querySelector('[data-vnext-zone="field"]')).toBeNull()
    // The pick is still there — the entire reason the two reads are apart.
    expect(zone('pick-list').querySelectorAll('button').length).toBeGreaterThan(0)
  })

  it('still counts the field when only the round read failed', () => {
    renderLms(lmsScenarios.roundUnavailableFieldOk, { onIntent: vi.fn(), onRetry: vi.fn() })
    expect(zone('field').textContent).toContain('83 still in')
    // The round offers its retry; the field, which answered, does not.
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('says nothing about the pool where there is nothing to count', () => {
    // `not-entered` — the BODY already says why. A second sentence here in
    // different words would be one fact explained twice.
    renderLms(lmsScenarios.notEntered, { onIntent: vi.fn() })
    expect(document.querySelector('[data-vnext-zone="field"]')).toBeNull()
  })

  /* ---------------------------------------------------------------- *
   * Three fixes that shipped with no coverage until a mutation said so
   * ---------------------------------------------------------------- */

  /**
   * A DEADLINE NEEDS A DAY. `formatTime` gives "11:00" and nothing else, and an
   * LMS deadline is routinely days away — so "Picks close 11:00" read on a
   * Tuesday for a Saturday lock is the worst ambiguity this product can make,
   * on the one page where missing a deadline costs a season. The surface this
   * replaces prints "Sat 15 Nov · 11:00".
   */
  it('says which day picks close, not just the time', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    const deadline = zone('round').textContent ?? ''
    expect(deadline).toContain('Picks close')
    // The world locks on 15 November and is generated on the 14th.
    expect(deadline).toMatch(/Picks close (Tomorrow|Today|Yesterday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)
  })

  it('says which day a locked round closed', () => {
    renderLms(lmsScenarios.lockedRound, { onIntent: vi.fn() })
    expect(zone('round').textContent).toMatch(
      /Picks closed (Tomorrow|Today|Yesterday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/,
    )
  })

  /**
   * THE TWO BINDING WORLDS MUST DIFFER ON SCREEN, not only in the model.
   *
   * `LmsPick.result` was mapped, fixtured and asserted in the mapper — and
   * never rendered. So `wonButEliminated` and `lostButAlive`, the pair the
   * whole stage rests on, were identical on the page apart from the standing
   * banner, and every test that "proved" the rule read the banner.
   */
  it('says what the picked club did, beside what the competition says the player is', () => {
    const won = renderLms(lmsScenarios.wonButEliminated, { onIntent: vi.fn() })
    expect(zone('pick-result').textContent).toContain('Your pick won')
    expect(document.body.textContent).toContain('You have been eliminated')
    won.unmount()

    renderLms(lmsScenarios.lostButAlive, { onIntent: vi.fn() })
    expect(zone('pick-result').textContent).toContain('Your pick lost')
    expect(document.body.textContent).toContain('You are still in')
  })

  it('says a postponed pick has no result, and does not read it as bad news', () => {
    renderLms(lmsScenarios.postponedPick, { onIntent: vi.fn() })
    const said = zone('pick-result').textContent ?? ''
    expect(said).toContain('no result yet')
    expect(said).toContain('never eliminates')
    expect(document.body.textContent).not.toContain('You have been eliminated')
  })

  /**
   * AN ELIMINATED PLAYER IS NOT INVITED TO PICK.
   *
   * Elimination blocks the PLAYER and leaves the round open, so gating the
   * prompt on the round's state alone put "Pick one club to win. You cannot use
   * it again." and then "No clubs left for you to pick in this round" directly
   * under a banner reading "You have been eliminated."
   */
  it('does not invite an eliminated player to pick in an open round', () => {
    renderLms(lmsScenarios.eliminated, { onIntent: vi.fn() })
    const round = zone('round').textContent ?? ''
    expect(document.body.textContent).toContain('You have been eliminated')
    expect(round).not.toContain('Pick one club to win')
    expect(round).not.toContain('No clubs left for you to pick')
  })

  it('still invites a live player in the same open round', () => {
    renderLms(lmsScenarios.openRound, { onIntent: vi.fn() })
    expect(zone('round').textContent).toContain('Pick one club to win')
  })

  it('counts what is still pickable', () => {
    renderLms(lmsScenarios.oneClubLeft, { onIntent: vi.fn() })
    // THE SINGULAR, because this is the round where the count is the warning.
    expect(zone('round').textContent).toContain('1 club still available')
    expect(zone('round').textContent).not.toContain('1 clubs')
  })
})

describe('the accessibility floor', () => {
  it.each(lmsScenarioNames)('%s has no critical or serious violation', async (name) => {
    await scan(
      <VNextRoot>
        <VNextShellProvider model={shellScenarios.oneCompetition}>
          <VNextLms model={lmsScenarios[name]} onIntent={vi.fn()} onRetry={vi.fn()} />
        </VNextShellProvider>
      </VNextRoot>,
    )
  })
})
