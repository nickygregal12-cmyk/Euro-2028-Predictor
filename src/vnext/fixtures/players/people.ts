/**
 * Fictional people for the vNext workshop: the signed-in user and the rivals
 * whose scores make the game social.
 *
 * Names vary in length and shape on purpose — a one-word name, a long
 * double-barrelled one and an accented one — because rival rows, ladders and
 * avatars all have to survive them.
 */

import type { PlayerRef } from '../../models/home'

export const workshopPeople = {
  user: {
    id: 'player-user',
    name: 'Nicky Gregal',
    initials: 'NG',
    avatarUrl: null,
    favouriteTeamId: 'team-glenmore',
  },
  jamie: {
    id: 'player-jamie',
    name: 'Jamie Ferguson-Whyte',
    initials: 'JF',
    avatarUrl: null,
    favouriteTeamId: 'team-strathkelvin',
  },
  martin: {
    id: 'player-martin',
    name: 'Martin Okafor',
    initials: 'MO',
    avatarUrl: null,
    favouriteTeamId: 'team-carrickvale',
  },
  aisha: {
    id: 'player-aisha',
    name: 'Aisha Rahman',
    initials: 'AR',
    avatarUrl: null,
    favouriteTeamId: 'team-porthaven',
  },
  soren: {
    id: 'player-soren',
    name: 'Søren Kjær',
    initials: 'SK',
    avatarUrl: null,
    favouriteTeamId: null,
  },
  bea: {
    id: 'player-bea',
    name: 'Bea',
    initials: 'B',
    avatarUrl: null,
    favouriteTeamId: 'team-balmorral',
  },
} as const satisfies Record<string, PlayerRef>
