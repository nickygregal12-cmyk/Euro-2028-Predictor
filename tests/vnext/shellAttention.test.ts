import { describe, expect, it } from 'vitest'
import { presentPlayInbox } from '../../src/features/hub/playInboxModel'
import type { PlayInbox, PlayInboxEntry } from '../../src/features/hub/playInboxModel'
import { buildShellAttention } from '../../src/vnext/integration/shell/buildShellAttention'
import { buildShellModel } from '../../src/vnext/integration/shell/buildShellModel'
import type { ShellSource } from '../../src/vnext/integration/shell/shellSource'
import { attentionElsewhere, contextNeedsAttention } from '../../src/vnext/models/shell'

/**
 * THE CROSS-COMPETITION ATTENTION LAYER.
 *
 * The route matrix ABSORBS `/play`, whose whole purpose is that a player never
 * has to choose a competition merely to discover what needs doing. vNext Home
 * is competition-scoped, so without this layer a cutover would leave a player
 * with games in two competitions nothing at all about the second.
 *
 * ============================ WHAT THESE CASES ARE FOR ====================
 *
 * The defect this layer is most likely to have is not "no items". It is an item
 * that goes to the WRONG COMPETITION, and the only way that happens is an
 * identity joined on something that is not an id. So the fixtures below give two
 * competitions the SAME DISPLAY NAME in more than one case, which is legal —
 * two seasons of one competition share it — and which a name join cannot
 * survive.
 *
 * `now` is always supplied. Nothing in this chain reads a clock.
 */

const NOW = new Date('2026-08-19T09:00:00.000Z')

/** Inside the urgent window `presentPlayInbox` measures against `NOW`. */
const SOON = '2026-08-19T18:00:00.000Z'
/** Outside it. */
const LATER = '2026-08-24T18:00:00.000Z'

function week(
  actions: readonly {
    kind: 'match_predictor' | 'last_man_standing' | 'championship'
    title: string
    locksAt: string | null
    outstanding: boolean
  }[],
) {
  return {
    primary: null,
    secondary: [],
    actions: actions.map((action) => ({ ...action, href: '/x' })),
    allClear: actions.every((action) => !action.outstanding),
    empty: actions.length === 0,
  }
}

function entry(over: Partial<PlayInboxEntry> & { tournamentId: string }): PlayInboxEntry {
  return {
    competitionName: 'Premier League',
    seasonLabel: '2026/27',
    week: week([]),
    ...over,
  }
}

function shell(over: Partial<ShellSource> = {}): ShellSource {
  return {
    competition: {
      tournamentId: 't-here',
      name: 'Premier League',
      seasonLabel: '2026/27',
      colours: { primary: '#0b2a4a', accent: '#7fc7ff' },
    },
    playerName: 'Rowan Adeyemi',
    outstandingGames: null,
    canNavigateAway: true,
    elsewhere: null,
    ...over,
  }
}

function elsewhere(
  competitions: readonly { tournamentId: string; name: string; seasonLabel?: string }[],
  inbox: PlayInbox | null,
) {
  return {
    competitions: competitions.map((entryRow) => ({
      tournamentId: entryRow.tournamentId,
      name: entryRow.name,
      seasonLabel: entryRow.seasonLabel ?? '2026/27',
    })),
    inbox,
  }
}

/* ==========================================================================
   THE SHAPES A PLAYER ACTUALLY ARRIVES IN
   ========================================================================== */

describe('what needs the player, and where', () => {
  it('says nothing at all with one competition and nothing outstanding', () => {
    const inbox = presentPlayInbox([entry({ tournamentId: 't-here' })], NOW)
    const model = buildShellModel(
      shell({ elsewhere: elsewhere([{ tournamentId: 't-here', name: 'Premier League' }], inbox) }),
    )

    expect(model.attention).toEqual([])
    expect(attentionElsewhere(model)).toEqual([])
  })

  it('says nothing with several competitions and nothing outstanding in any', () => {
    const inbox = presentPlayInbox(
      [
        entry({ tournamentId: 't-here' }),
        entry({ tournamentId: 't-there', competitionName: 'Champions League' }),
        entry({ tournamentId: 't-third', competitionName: 'Scottish Premiership' }),
      ],
      NOW,
    )
    const model = buildShellModel(
      shell({
        elsewhere: elsewhere(
          [
            { tournamentId: 't-here', name: 'Premier League' },
            { tournamentId: 't-there', name: 'Champions League' },
            { tournamentId: 't-third', name: 'Scottish Premiership' },
          ],
          inbox,
        ),
      }),
    )

    // Three contexts to switch between, and nothing waiting in any of them.
    expect(model.contexts).toHaveLength(3)
    expect(attentionElsewhere(model)).toEqual([])
  })

  it('reports nothing in the chrome when the only action is in the CURRENT competition', () => {
    // Home answers "what matters here?". An attention control repeating this
    // competition's own deadline would be Home's job leaking upwards.
    const inbox = presentPlayInbox(
      [
        entry({
          tournamentId: 't-here',
          week: week([
            { kind: 'match_predictor', title: '3 predictions needed', locksAt: SOON, outstanding: true },
          ]),
        }),
        entry({ tournamentId: 't-there', competitionName: 'Champions League' }),
      ],
      NOW,
    )
    const model = buildShellModel(
      shell({
        elsewhere: elsewhere(
          [
            { tournamentId: 't-here', name: 'Premier League' },
            { tournamentId: 't-there', name: 'Champions League' },
          ],
          inbox,
        ),
      }),
    )

    // The mapper carried it — the model knows — and the shell shows nothing.
    expect(model.attention).toHaveLength(1)
    expect(attentionElsewhere(model)).toEqual([])
    // And the current competition's own switcher row still knows.
    expect(contextNeedsAttention(model, 't-here')).toBe(true)
  })

  it('reports an action in ANOTHER competition, naming its game apart from it', () => {
    const inbox = presentPlayInbox(
      [
        entry({ tournamentId: 't-here' }),
        entry({
          tournamentId: 't-there',
          competitionName: 'Champions League',
          week: week([
            { kind: 'last_man_standing', title: 'Pick your club', locksAt: SOON, outstanding: true },
          ]),
        }),
      ],
      NOW,
    )
    const model = buildShellModel(
      shell({
        elsewhere: elsewhere(
          [
            { tournamentId: 't-here', name: 'Premier League' },
            { tournamentId: 't-there', name: 'Champions League' },
          ],
          inbox,
        ),
      }),
    )

    const items = attentionElsewhere(model)
    expect(items).toHaveLength(1)
    expect(items[0]?.contextId).toBe('t-there')
    // The competition is NOT in the headline. It is `contextId`, and the shell
    // resolves it against `contexts` — which is what keeps the two dimensions
    // apart on the row.
    expect(items[0]?.game).toBe('last-man-standing')
    expect(items[0]?.headline).toBe('Pick your club')
    expect(items[0]?.headline).not.toMatch(/Champions League/)
  })

  it('reports actions in several other competitions, urgent before soon', () => {
    const inbox = presentPlayInbox(
      [
        entry({ tournamentId: 't-here' }),
        entry({
          tournamentId: 't-there',
          competitionName: 'Champions League',
          week: week([
            { kind: 'match_predictor', title: 'Later', locksAt: LATER, outstanding: true },
          ]),
        }),
        entry({
          tournamentId: 't-third',
          competitionName: 'Scottish Premiership',
          week: week([
            { kind: 'championship', title: 'Submit your Penalty Number', locksAt: SOON, outstanding: true },
          ]),
        }),
      ],
      NOW,
    )
    const model = buildShellModel(
      shell({
        elsewhere: elsewhere(
          [
            { tournamentId: 't-here', name: 'Premier League' },
            { tournamentId: 't-there', name: 'Champions League' },
            { tournamentId: 't-third', name: 'Scottish Premiership' },
          ],
          inbox,
        ),
      }),
    )

    const items = attentionElsewhere(model)
    expect(items.map((item) => item.contextId)).toEqual(['t-third', 't-there'])
    expect(items.map((item) => item.urgency)).toEqual(['urgent', 'soon'])
  })

  it('lets one competition fail without blanking the others', () => {
    // `presentPlayInbox`'s own rule, reaching the shell unchanged: one
    // unreadable competition must not hide four readable ones. A shell that
    // reported nothing here would tell a player they are up to date while a
    // lock passes somewhere it could not see.
    const inbox = presentPlayInbox(
      [
        entry({ tournamentId: 't-here' }),
        entry({ tournamentId: 't-broken', competitionName: 'Serie A', week: null }),
        entry({
          tournamentId: 't-there',
          competitionName: 'Champions League',
          week: week([
            { kind: 'match_predictor', title: '5 predictions needed', locksAt: SOON, outstanding: true },
          ]),
        }),
      ],
      NOW,
    )
    const model = buildShellModel(
      shell({
        elsewhere: elsewhere(
          [
            { tournamentId: 't-here', name: 'Premier League' },
            { tournamentId: 't-broken', name: 'Serie A' },
            { tournamentId: 't-there', name: 'Champions League' },
          ],
          inbox,
        ),
      }),
    )

    expect(attentionElsewhere(model).map((item) => item.contextId)).toEqual(['t-there'])
    // The competition that failed is still addressable, so a surface that wants
    // to offer to take the player there has an id and not only a caption.
    expect(inbox.unreadable).toEqual([
      { tournamentId: 't-broken', competitionName: 'Serie A' },
    ])
  })
})

/* ==========================================================================
   IDENTITY — the defect this layer would actually have
   ========================================================================== */

describe('a competition is addressed, never described', () => {
  it('sends the player to the right competition when two share a display name', () => {
    // THE ASSERTION THIS FILE EXISTS FOR. Two seasons of one competition
    // legitimately share a name. A mapper that joined on it would send this
    // player into the season they are NOT being asked for, and the row would
    // look perfectly correct on screen.
    const inbox = presentPlayInbox(
      [
        entry({ tournamentId: 't-2026', competitionName: 'Premier League', seasonLabel: '2026/27' }),
        entry({
          tournamentId: 't-2027',
          competitionName: 'Premier League',
          seasonLabel: '2027/28',
          week: week([
            { kind: 'match_predictor', title: '3 predictions needed', locksAt: SOON, outstanding: true },
          ]),
        }),
      ],
      NOW,
    )
    const model = buildShellModel(
      shell({
        competition: {
          tournamentId: 't-2026',
          name: 'Premier League',
          seasonLabel: '2026/27',
          colours: null,
        },
        elsewhere: elsewhere(
          [
            { tournamentId: 't-2026', name: 'Premier League', seasonLabel: '2026/27' },
            { tournamentId: 't-2027', name: 'Premier League', seasonLabel: '2027/28' },
          ],
          inbox,
        ),
      }),
    )

    const items = attentionElsewhere(model)
    expect(items).toHaveLength(1)
    expect(items[0]?.contextId).toBe('t-2027')
    // And the shell can resolve it to a context, which is what one press needs.
    expect(model.contexts.map((context) => context.competition.id)).toEqual(['t-2026', 't-2027'])
  })

  it('gives two same-named competitions distinct item ids', () => {
    // `InboxAction.key` used to be built from the display name, so these two
    // collided — one React key for two rows, and one attention item where there
    // were two things to do.
    const inbox = presentPlayInbox(
      [
        entry({
          tournamentId: 't-a',
          competitionName: 'Premier League',
          week: week([
            { kind: 'match_predictor', title: 'A', locksAt: SOON, outstanding: true },
          ]),
        }),
        entry({
          tournamentId: 't-b',
          competitionName: 'Premier League',
          week: week([
            { kind: 'match_predictor', title: 'B', locksAt: SOON, outstanding: true },
          ]),
        }),
      ],
      NOW,
    )
    const items = buildShellAttention(inbox)
    expect(new Set(items.map((item) => item.id)).size).toBe(2)
  })

  it('produces no duplicate item for one action', () => {
    const inbox = presentPlayInbox(
      [
        entry({
          tournamentId: 't-there',
          competitionName: 'Champions League',
          week: week([
            { kind: 'match_predictor', title: '3 predictions needed', locksAt: SOON, outstanding: true },
          ]),
        }),
      ],
      NOW,
    )
    const model = buildShellModel(
      shell({
        elsewhere: elsewhere([{ tournamentId: 't-there', name: 'Champions League' }], inbox),
      }),
    )

    expect(model.attention).toHaveLength(1)
    expect(attentionElsewhere(model)).toHaveLength(1)
  })

  it('shows the active competition once even though both reads name it', () => {
    // The page's competition and the player's list overlap by design. Joined on
    // the id they are one context; joined on nothing they would be two, and the
    // switcher would offer the competition the player is already in, twice.
    const model = buildShellModel(
      shell({
        elsewhere: elsewhere(
          [
            { tournamentId: 't-here', name: 'Premier League' },
            { tournamentId: 't-there', name: 'Champions League' },
          ],
          null,
        ),
      }),
    )
    expect(model.contexts.map((context) => context.competition.id)).toEqual(['t-here', 't-there'])
    // The active one keeps the palette the page resolved; the other has none to
    // state and gets the neutral fallback rather than a borrowed identity.
    expect(model.contexts[0]?.competition.colours.primary).toBe('#0b2a4a')
    expect(model.contexts[1]?.competition.colours.primary).not.toBe('#0b2a4a')
  })

  it('drops an item whose competition cannot be addressed at all', () => {
    // The one way `tournamentId` is empty: a competition whose week failed to
    // read AND whose catalogue row was missing. A row that cannot go anywhere is
    // a control that teaches the player the product is broken.
    const items = buildShellAttention({
      urgent: [
        {
          key: 'k',
          kind: 'match_predictor',
          tournamentId: '',
          competitionName: 'A competition',
          seasonLabel: '',
          gameName: 'Match Predictor',
          title: 'Something',
          locksAt: SOON,
          href: null,
          outstanding: true,
        },
      ],
      thisWeek: [],
      settled: [],
      unreadable: [],
      allClear: false,
      empty: false,
    })
    expect(items).toEqual([])
  })
})

/* ==========================================================================
   WHAT IT REFUSES TO CLAIM
   ========================================================================== */

describe('it claims only event classes the reads produce', () => {
  it('never reports a settled action as attention', () => {
    // `settled` is "done, waiting or settled". An attention layer that reported
    // a finished matchweek would be a notification feed.
    const inbox = presentPlayInbox(
      [
        entry({
          tournamentId: 't-there',
          competitionName: 'Champions League',
          week: week([
            { kind: 'match_predictor', title: 'All in', locksAt: SOON, outstanding: false },
          ]),
        }),
      ],
      NOW,
    )
    expect(inbox.settled).toHaveLength(1)
    expect(buildShellAttention(inbox)).toEqual([])
  })

  it('never emits `live`, because no read reports a match in play here', () => {
    const inbox = presentPlayInbox(
      [
        entry({
          tournamentId: 't-there',
          competitionName: 'Champions League',
          week: week([
            { kind: 'match_predictor', title: 'Now', locksAt: SOON, outstanding: true },
            { kind: 'championship', title: 'Later', locksAt: LATER, outstanding: true },
            { kind: 'last_man_standing', title: 'No deadline', locksAt: null, outstanding: true },
          ]),
        }),
      ],
      NOW,
    )
    const urgencies = new Set(buildShellAttention(inbox).map((item) => item.urgency))
    expect(urgencies.has('live')).toBe(false)
    expect([...urgencies].sort()).toEqual(['soon', 'urgent'])
  })

  it('invents no deadline for an action the game gave none', () => {
    const inbox = presentPlayInbox(
      [
        entry({
          tournamentId: 't-there',
          competitionName: 'Champions League',
          week: week([
            { kind: 'last_man_standing', title: 'Pick your club', locksAt: null, outstanding: true },
          ]),
        }),
      ],
      NOW,
    )
    const [item] = buildShellAttention(inbox)
    expect(item?.detail).not.toMatch(/\d{1,2}:\d{2}|minute|hour/i)
  })

  it('is `null`-safe, and a host that loads no inbox gets no claim', () => {
    expect(buildShellAttention(null)).toEqual([])
    expect(buildShellModel(shell()).attention).toEqual([])
    // And an inbox that has not landed yet is not an empty one.
    const model = buildShellModel(
      shell({ elsewhere: elsewhere([{ tournamentId: 't-there', name: 'CL' }], null) }),
    )
    expect(model.attention).toEqual([])
    expect(model.contexts).toHaveLength(2)
  })

  it('reads no clock: the same inbox maps identically at any instant', () => {
    const entries = [
      entry({
        tournamentId: 't-there',
        competitionName: 'Champions League',
        week: week([
          { kind: 'match_predictor', title: 'Now', locksAt: SOON, outstanding: true },
        ]),
      }),
    ]
    const inbox = presentPlayInbox(entries, NOW)
    expect(buildShellAttention(inbox)).toEqual(buildShellAttention(inbox))
  })
})
