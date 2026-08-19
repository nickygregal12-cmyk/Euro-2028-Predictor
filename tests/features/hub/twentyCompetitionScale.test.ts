import { describe, expect, it } from 'vitest'
import {
  TWENTY_COMPETITION_CATALOGUE,
  TWENTY_COMPETITION_MEMBERSHIP,
  twentyCompetitionPlayer,
} from '../../../src/dev/scaleFixture'
import {
  COMPETITION_SHORTCUT_LIMIT,
  competitionsPlaying,
  presentPlayerCompetitions,
} from '../../../src/features/hub/playerCompetitions'
import { gamesJoinedFirst } from '../../../src/features/hub/competitionCatalogue'
import { presentExplore } from '../../../src/features/hub/exploreModel'
import { presentPlayInbox } from '../../../src/features/hub/playInboxModel'
import { presentPrivatePlay } from '../../../src/features/hub/privatePlayModel'

/**
 * The twenty-competition scalability contract, as an executable acceptance
 * test.
 *
 * WHY IT EXISTS AS A TEST RATHER THAN A REVIEW NOTE. The 10 August authority
 * makes this binding: "if adding seventeen synthetic competitions makes
 * ordinary signed-in navigation visibly noisy, the architecture has failed the
 * requirement." With two competitions in the real catalogue every bounded list
 * looks exactly like an unbounded one, so the requirement is unfalsifiable
 * without a fixture — and the failure it guards against is a slow one, arriving
 * with the third and fourth competition rather than at the moment the mistake
 * is made.
 *
 * THE PLAYER PLAYS IN THREE OF TWENTY, and the three are deliberately not the
 * first three in the catalogue.
 *
 * WHAT IT ASSERTS is that every global surface is a function of what the player
 * plays in, not of what the platform publishes. The rail's own version of this
 * lives in `tests/app/desktopRail.test.tsx`, because a rail is a rendered thing
 * and these are models.
 */

const player = twentyCompetitionPlayer()

describe('a twenty-competition platform, for a player who plays in three', () => {
  it('starts from a catalogue of twenty', () => {
    // Guard the guard: if the fixture shrank, every assertion below would pass
    // for the wrong reason.
    expect(TWENTY_COMPETITION_CATALOGUE).toHaveLength(20)
    expect(TWENTY_COMPETITION_MEMBERSHIP).toHaveLength(20)
  })

  it('is relevant to three competitions, not twenty', () => {
    expect(player.mine.map((entry) => entry.competition.name)).toEqual([
      // Two games joined here, so it sorts first: a competition a player plays
      // two games in is more theirs than one they play a single game in.
      'Premier League',
      'Scottish Premiership',
      'Champions League',
    ])
    expect(player.catalogue).toHaveLength(20)
    expect(player.empty).toBe(false)
  })

  it('never claims a follow it cannot store', () => {
    // Follow, Join game and Favourite are three separate choices. Nothing here
    // may report a follow derived from a membership.
    for (const entry of player.mine) {
      expect(entry.followed).toBe('unknown')
      expect(entry.favourite).toBe('unknown')
      expect(entry.joinedGames.length).toBeGreaterThan(0)
    }
    expect(player.relevanceSource).toBe('game-membership')
  })

  it('bounds the navigation shortcuts however many competitions are joined', () => {
    expect(player.shortcuts.length).toBeLessThanOrEqual(COMPETITION_SHORTCUT_LIMIT)
    expect(player.shortcuts).toHaveLength(3)
    expect(player.overflow).toBe(0)
  })

  it('keeps the whole catalogue reachable without putting it in navigation', () => {
    const explore = presentExplore(player, '')
    const listed = explore.groups.flatMap((group) => group.entries)
    expect(listed).toHaveLength(20)

    // Pinned first, so a growing catalogue does not bury the player's own.
    expect(explore.groups[0]?.title).toBe('Your competitions')
    expect(explore.groups[0]?.entries).toHaveLength(3)
    expect(explore.groups[1]?.entries).toHaveLength(17)
  })

  it('searches the catalogue rather than making the player scroll it', () => {
    // A substring match, so "liga" finds every league whose name contains it —
    // which is what a player typing three letters wants, not an exact match.
    const found = presentExplore(player, 'liga')
    const names = found.groups.flatMap((group) => group.entries).map((e) => e.competition.name)
    expect(names).toContain('La Liga')
    expect(names).toContain('Bundesliga')
    expect(names).not.toContain('Serie A')
    expect(presentExplore(player, 'zzz').noMatches).toBe(true)
  })

  it('puts only joined games in the action inbox', () => {
    // Seventeen competitions the player does not play in contribute nothing —
    // an available game is discovery, never an action.
    const inbox = presentPlayInbox(
      player.mine.map((entry) => ({
        tournamentId: entry.competition.tournamentId,
        competitionName: entry.competition.name,
        seasonLabel: entry.competition.seasonLabel,
        week: {
          primary: null,
          secondary: [],
          actions: [
            {
              kind: 'match_predictor' as const,
              title: '3 predictions needed',
              locksAt: '2026-08-10T14:00:00Z',
              outstanding: true,
              href: '/x',
            },
          ],
          allClear: false,
          empty: false,
        },
      })),
      new Date('2026-08-10T09:00:00Z'),
    )
    expect(inbox.urgent).toHaveLength(3)
    expect(inbox.thisWeek).toHaveLength(0)
    expect(inbox.unreadable).toHaveLength(0)
  })

  it('names a competition it could not read rather than dropping it', () => {
    const inbox = presentPlayInbox(
      [
        {
          tournamentId: 't-premier-league',
          competitionName: 'Premier League',
          seasonLabel: '2026/27',
          week: null,
        },
        {
          tournamentId: 't-champions-league',
          competitionName: 'Champions League',
          seasonLabel: '2026/27',
          week: { primary: null, secondary: [], actions: [], allClear: true, empty: false },
        },
      ],
      new Date('2026-08-10T09:00:00Z'),
    )
    // "Nothing to do" and "we could not check" are different sentences, and
    // only one of them is safe while a lock is passing.
    // NAMED AND ADDRESSED. A surface that can only say which competition broke
    // cannot offer to take the player there.
    expect(inbox.unreadable).toEqual([
      { tournamentId: 't-premier-league', competitionName: 'Premier League' },
    ])
    expect(inbox.allClear).toBe(true)
  })

  it('lists private play by container, never by football competition first', () => {
    const view = presentPrivatePlay(
      [
        {
          competitionName: 'Premier League',
          seasonLabel: '2026/27',
          gameKey: 'main_predictor',
          href: '/a',
          leagues: [
            {
              id: 'l1',
              name: 'The Saturday Crew',
              inviteCode: 'ABC123',
              memberCount: 12,
              isOwner: true,
              ownerName: 'You',
              lastActivityAt: null,
            },
          ],
        },
        {
          competitionName: 'Champions League',
          seasonLabel: '2026/27',
          gameKey: 'last_man_standing',
          href: '/b',
          leagues: [
            {
              id: 'l2',
              name: 'Work LMS',
              inviteCode: 'DEF456',
              memberCount: 5,
              isOwner: false,
              ownerName: 'Jamie',
              lastActivityAt: null,
            },
          ],
        },
      ],
      [],
    )

    expect(view.entries.map((entry) => entry.name)).toEqual(['The Saturday Crew', 'Work LMS'])
    // Each card carries the context that makes its name mean something once a
    // player has two leagues in two competitions.
    expect(view.entries[0]?.competitionName).toBe('Premier League')
    expect(view.entries[1]?.gameName).toBe('Last Man Standing')
    expect(view.counts.all).toBe(2)
  })

  it('answers which competitions run a given game the player joined', () => {
    expect(competitionsPlaying(player, 'main_predictor')).toHaveLength(3)
    expect(competitionsPlaying(player, 'last_man_standing')).toHaveLength(1)
    expect(competitionsPlaying(player, 'predictor_cup')).toHaveLength(0)
  })

  it('does not grow the shortcut list when the catalogue grows', () => {
    // The same player on a platform that has published twenty more.
    const bigger = presentPlayerCompetitions(
      [
        ...TWENTY_COMPETITION_CATALOGUE,
        ...TWENTY_COMPETITION_CATALOGUE.map((competition) => ({
          ...competition,
          competitionSlug: `${competition.competitionSlug}-b`,
          seasonRowName: `${competition.seasonRowName} B`,
          name: `${competition.name} B`,
        })),
      ],
      TWENTY_COMPETITION_MEMBERSHIP,
    )
    expect(bigger.catalogue).toHaveLength(40)
    // Unchanged: the player joined nothing new.
    expect(bigger.shortcuts).toHaveLength(3)
    expect(bigger.mine).toHaveLength(3)
  })
})

/**
 * `UI-F08` — joined games before available ones.
 *
 * The five-second test again: a player opens Games to do something in a game
 * they are IN, and the catalogue's declaration order put an unjoined game above
 * a joined one whenever it happened to list it first.
 */
describe('the Games section leads with what the player plays', () => {
  function game(name: string, joined: boolean) {
    return {
      kind: 'league-predictor' as const,
      gameKey: 'main_predictor' as const,
      name,
      description: '',
      joined,
      status: (joined ? 'joined' : 'available') as 'joined' | 'available',
    }
  }

  it('puts joined games first and keeps the catalogue order within each half', () => {
    const ordered = gamesJoinedFirst([
      game('Match Predictor', false),
      game('Last Man Standing', true),
      game('Predictor Championship', false),
    ])
    expect(ordered.map((entry) => entry.name)).toEqual([
      'Last Man Standing',
      'Match Predictor',
      'Predictor Championship',
    ])
  })

  it('leaves an all-joined or all-available list exactly as the catalogue lists it', () => {
    const names = ['A', 'B', 'C']
    for (const joined of [true, false]) {
      expect(gamesJoinedFirst(names.map((name) => game(name, joined))).map((e) => e.name)).toEqual(
        names,
      )
    }
  })
})
