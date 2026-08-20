/**
 * Fictional clubs for the vNext workshop.
 *
 * They are deliberately invented rather than real Scottish Premiership sides.
 * The workshop needs plausible football identity — long names, three-letter
 * codes, kit patterns, colour pairs that have to survive a contrast check — and
 * it needs none of the trademark, likeness or accuracy obligations that come
 * with shipping real club branding in a mock. Nothing downstream may treat
 * these as a club registry.
 *
 * `onPrimary` is stated per club because a wrong answer is a contrast failure.
 * Long names ("Inverness Caledonian Rangers") are present on purpose so layouts
 * are tested against the worst realistic string, not the shortest.
 */

import type { Team } from '../../models/football'

export const workshopTeams = {
  glenmore: {
    id: 'team-glenmore',
    name: 'Glenmore Athletic',
    shortName: 'Glenmore',
    abbreviation: 'GLN',
    colours: {
      primary: '#0B4DA2',
      secondary: '#F2F4F8',
      accent: '#4FA3FF',
      onPrimary: 'light',
    },
    kitPattern: 'solid',
    officialBadge: null,
  },
  strathkelvin: {
    id: 'team-strathkelvin',
    name: 'Strathkelvin United',
    shortName: 'Strathkelvin',
    abbreviation: 'STK',
    colours: {
      primary: '#0F7A3D',
      secondary: '#FFFFFF',
      accent: '#39D97C',
      onPrimary: 'light',
    },
    kitPattern: 'hoops',
    officialBadge: null,
  },
  carrickvale: {
    id: 'team-carrickvale',
    name: 'Carrickvale Rovers',
    shortName: 'Carrickvale',
    abbreviation: 'CRV',
    colours: {
      primary: '#8B1E3F',
      secondary: '#E8D9A0',
      accent: '#FF6B8A',
      onPrimary: 'light',
    },
    kitPattern: 'halves',
    officialBadge: null,
  },
  balmorral: {
    id: 'team-balmorral',
    name: 'Balmorral Thistle',
    shortName: 'Balmorral',
    abbreviation: 'BAL',
    colours: {
      primary: '#F0C419',
      secondary: '#1A1A1A',
      accent: '#FFE071',
      onPrimary: 'dark',
    },
    kitPattern: 'stripes',
    officialBadge: null,
  },
  invercaledonian: {
    id: 'team-invercaledonian',
    name: 'Inverness Caledonian Rangers',
    shortName: 'Inver Caledonian',
    abbreviation: 'ICR',
    colours: {
      primary: '#1C2B4A',
      secondary: '#C8102E',
      accent: '#7FA8FF',
      onPrimary: 'light',
    },
    kitPattern: 'stripes',
    officialBadge: null,
  },
  porthaven: {
    id: 'team-porthaven',
    name: 'Porthaven City',
    shortName: 'Porthaven',
    abbreviation: 'PHV',
    colours: {
      primary: '#5B2E91',
      secondary: '#F5F0FF',
      accent: '#B98CFF',
      onPrimary: 'light',
    },
    kitPattern: 'solid',
    officialBadge: null,
  },
  eastcraig: {
    id: 'team-eastcraig',
    name: 'Eastcraig Albion',
    shortName: 'Eastcraig',
    abbreviation: 'ECA',
    colours: {
      primary: '#B5451B',
      secondary: '#2B2B2B',
      accent: '#FF8A5B',
      onPrimary: 'light',
    },
    kitPattern: 'solid',
    officialBadge: null,
  },
  dunveggie: {
    id: 'team-dunveggie',
    name: 'Dunveggie Harriers',
    shortName: 'Dunveggie',
    abbreviation: 'DUN',
    colours: {
      primary: '#0E6E76',
      secondary: '#EAF7F8',
      accent: '#4BD6E0',
      onPrimary: 'light',
    },
    kitPattern: 'hoops',
    officialBadge: null,
  },
  kirktonmuir: {
    id: 'team-kirktonmuir',
    name: 'Kirktonmuir Wanderers',
    shortName: 'Kirktonmuir',
    abbreviation: 'KTM',
    colours: {
      primary: '#1F1F24',
      secondary: '#D8DBE2',
      accent: '#9AA5FF',
      onPrimary: 'light',
    },
    kitPattern: 'stripes',
    officialBadge: null,
  },
  arbrennan: {
    id: 'team-arbrennan',
    name: 'Arbrennan Saints',
    shortName: 'Arbrennan',
    abbreviation: 'ARB',
    colours: {
      primary: '#D64545',
      secondary: '#FFF3F3',
      accent: '#FF9C9C',
      onPrimary: 'light',
    },
    kitPattern: 'halves',
    officialBadge: null,
  },
  /**
   * THE SASH CLUB. The domain's kit vocabulary has always had five patterns and
   * the owner's reference data uses all five, but no workshop club wore the
   * fifth — so the one treatment with a diagonal, the one most likely to clash
   * with a monogram and the one most likely to look wrong at 24px had no board
   * to be reviewed on.
   *
   * Its colours are a deliberately hard pair: a mid-tone primary with a light
   * band across it, which is where a sash is most likely to swallow the code.
   */
  braemarloch: {
    id: 'team-braemarloch',
    name: 'Braemarloch Academical',
    shortName: 'Braemarloch',
    abbreviation: 'BRA',
    colours: {
      primary: '#2B4C7E',
      secondary: '#E4B363',
      accent: '#7FA6D9',
      onPrimary: 'light',
    },
    kitPattern: 'sash',
    officialBadge: null,
  },
} as const satisfies Record<string, Team>

export const workshopTeamList: readonly Team[] = Object.values(workshopTeams)
