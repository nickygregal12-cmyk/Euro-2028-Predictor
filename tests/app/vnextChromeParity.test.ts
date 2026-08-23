import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * WHAT A CUTOVER LOSES WHEN NOBODY IS COUNTING THE CHROME.
 *
 * ============================ THE DEFECT THIS EXISTS FOR =================
 *
 * The Football Hub cutover made `vNextOwnsFrame(pathname)` true for every Hub
 * destination. That branch of `AppShell` renders `AdminUtilityEntry` and an
 * `Outlet` — no `AppBar` — and the AppBar was the only way into
 * `src/app/ActionCentre.tsx`. So `get_my_actions`, `mark_actions_seen` and
 * `dismiss_action` became unreachable from the production frame while five
 * server generators and a `pg_cron` caller carried on filling
 * `player_action_items`. It stayed that way, and `MIG-UI-14` stayed marked
 * **Implemented** throughout, because the claim had been true when it was
 * written.
 *
 * ============================ WHY NOTHING CAUGHT IT ======================
 *
 * `vnextFrameOwnership.test.ts` is a real guard and it could never have caught
 * this: it reconciles the frame-ownership table against the ROUTE TREE in
 * `src/App.tsx`. `docs/product/vnext-route-migration-matrix.md` owns route fate
 * for the same reason. **The Action Centre was never a route.** It was a
 * control in the AppBar, and a matrix of addresses cannot notice the loss of
 * something that never had one.
 *
 * That is the reusable lesson, and it is about to matter again: Stage 15 is the
 * Euro 2028 vNext adoption, which is the same cutover shape against a different
 * frame.
 *
 * ============================ WHAT THIS ASSERTS ==========================
 *
 * `AppBarProps` is the legacy signed-in chrome's own list of what it offers.
 * Every member of it must be CLASSIFIED below — either answered somewhere in
 * the vNext frame, or dropped on purpose with the reason written down. Adding
 * an affordance to the AppBar without saying what vNext does about it fails
 * here.
 *
 * It reads the real file rather than a copy, so the two cannot drift.
 *
 * ============================ WHAT IT DELIBERATELY DOES NOT DO ===========
 *
 * It does not assert that any particular component renders. That would be a
 * second opinion about the surface tests, which already prove the Action Centre
 * opens, the account door works and the theme choice persists. This is a
 * COMPLETENESS check over a list, which is the part no other test owns.
 */

const APP_BAR = readFileSync('src/design-system/AppBar.tsx', 'utf8')

/**
 * The top-level members of `AppBarProps`, read out of the source.
 *
 * Brace-depth rather than a regex over the whole block, because `actions` is
 * itself an object type and its `outstanding` and `onOpen` are not affordances
 * of the bar — they are the shape of one.
 */
function appBarAffordances(): readonly string[] {
  const start = APP_BAR.indexOf('export type AppBarProps = {')
  if (start === -1) {
    throw new Error(
      'AppBarProps was not found in src/design-system/AppBar.tsx. If the legacy ' +
        'chrome has been renamed or retired, this guard needs rewriting rather ' +
        'than deleting: the question it asks — what does the old frame offer ' +
        'that the new one does not — outlives the component.',
    )
  }

  const names: string[] = []
  let depth = 0
  for (const raw of APP_BAR.slice(start).split('\n')) {
    const line = raw.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
    // Members are read at depth 1, which is the body of the type itself.
    if (depth === 1) {
      const member = /^\s*(\w+)\??\s*:/.exec(line)
      if (member?.[1]) names.push(member[1])
    }
    depth += (line.match(/\{/g) ?? []).length
    depth -= (line.match(/\}/g) ?? []).length
    if (depth === 0 && names.length > 0) break
  }
  return names
}

/**
 * WHERE THE vNEXT FRAME ANSWERS EACH ONE.
 *
 * The value is the reason, and it is written for somebody reading a failure
 * rather than for somebody reading the passing list.
 */
const ANSWERED: Readonly<Record<string, string>> = {
  context:
    'The competition switcher and the page header carry it. The Competition ' +
    'Deck makes the football context the loudest thing in the masthead, so it ' +
    'is answered more strongly than the legacy bar answered it.',
  theme:
    'DEC-016 and UX-005. The choice moved from a bar toggle to a persisted ' +
    'three-way preference on vNext Account, wired through `useTheme` in ' +
    '`VNextHubDestinations`. A deliberate relocation rather than a loss.',
  onToggleTheme: 'Same as `theme` — the Account preference replaces the toggle.',
  displayName: 'The masthead avatar renders the initials and the accessible name.',
  onOpenProfile: "The avatar emits `{ kind: 'account' }`, which the seam navigates.",
  actions:
    'The Action Centre. THIS IS THE ONE THAT WAS LOST at the Football Hub ' +
    'cutover and re-answered later: `ActionCentreControl` in the masthead and ' +
    'the rail, `ActionCentreBody` in a shell overlay, over the same ' +
    '`get_my_actions` / `mark_actions_seen` / `dismiss_action` contract.',
}

/**
 * Affordances the vNext frame deliberately does NOT answer.
 *
 * Empty today, and that is a fact rather than an oversight — every member of
 * the legacy bar has a vNext home. It exists so that a future decision to drop
 * one has somewhere to be recorded that is not a deleted assertion.
 */
const DELIBERATELY_DROPPED: Readonly<Record<string, string>> = {}

describe('the vNext frame answers the legacy signed-in chrome', () => {
  it('classifies every affordance the AppBar offers', () => {
    const unclassified = appBarAffordances().filter(
      (name) => !(name in ANSWERED) && !(name in DELIBERATELY_DROPPED),
    )

    expect(
      unclassified,
      unclassified.length === 0
        ? ''
        : `The legacy AppBar offers ${unclassified.join(', ')} and this file does not say ` +
          'what the vNext frame does about it.\n\n' +
          'This is the check that would have caught the Action Centre being ' +
          'orphaned by the Football Hub cutover. A route matrix cannot: the ' +
          'Action Centre was never a route, it was a control in this bar, and ' +
          'it went unreachable for a whole stage while its requirement stayed ' +
          'marked Implemented.\n\n' +
          'Add the affordance to ANSWERED with where vNext answers it, or to ' +
          'DELIBERATELY_DROPPED with why it is not worth answering. Do not ' +
          'delete the affordance from the AppBar to make this pass unless the ' +
          'legacy frame genuinely no longer offers it.',
    ).toEqual([])
  })

  it('finds the affordances at all, so a silent rename cannot empty the guard', () => {
    // A parser that quietly returned nothing would make every assertion above
    // vacuously true — the failure mode a completeness check is most prone to.
    const affordances = appBarAffordances()
    expect(affordances.length).toBeGreaterThanOrEqual(4)
    expect(affordances).toContain('actions')
  })

  it('reads only members of the bar, not the shape of one of them', () => {
    // `actions` is an object type; `outstanding` and `onOpen` are its fields
    // and not things the bar offers. A depth-blind parser would classify them
    // as affordances and demand vNext answers for two fields of one control.
    const affordances = appBarAffordances()
    expect(affordances).not.toContain('outstanding')
    expect(affordances).not.toContain('onOpen')
  })

  it('records no dropped affordance today, because there is none', () => {
    // Asserted rather than assumed: if somebody adds an entry here, the pair of
    // lists stops being "everything is answered" and the claim in this file's
    // header has to change with it.
    expect(Object.keys(DELIBERATELY_DROPPED)).toEqual([])
  })
})
