/**
 * Ten more fictional clubs, so a whole matchweek can be reviewed.
 *
 * WHY A SECOND FILE RATHER THAN TEN MORE ENTRIES IN `teams/teams.ts`. That file
 * holds the ten clubs the approved Home matchday is built from, and
 * `workshopTeamList` — which every one of them is in — is rendered in full by
 * `vNext/Football`'s identity story. Adding to it would change an existing
 * review surface as a side effect of building a different page, and Stage 7 is
 * not allowed to edit approved scenarios. These are additive and nothing outside
 * `fixtures/predictor/` reads them.
 *
 * WHY THERE HAVE TO BE TWENTY CLUBS AT ALL. The brief's own sentence is the
 * requirement: "a user predicting ten matches should be able to work through them
 * comfortably". Ten matches needs twenty clubs, and reviewing a card of five
 * would be reviewing a card that is comfortable because it is short. The list
 * length is the thing under test as much as the row is.
 *
 * Same obligations as the original ten: invented rather than real, so there is no
 * trademark or likeness question in a mock; `onPrimary` stated per club because
 * guessing it is guessing at a contrast failure; and long names on purpose —
 * "Auchentoshan Corinthians" and "Strathallan Caledonian Thistle" exist so the
 * row is tested against the worst realistic string rather than the shortest.
 * Nothing downstream may treat these as a club registry.
 */

import type { Team } from '../../models/football'

export const predictorClubs = {
  auchentoshan: {
    id: 'team-auchentoshan',
    name: 'Auchentoshan Corinthians',
    shortName: 'Auchentoshan',
    abbreviation: 'AUC',
    colours: {
      primary: '#123C6B',
      secondary: '#F7C948',
      accent: '#6FA8DC',
      onPrimary: 'light',
    },
    kitPattern: 'halves',
    officialBadge: null,
  },
  strathallan: {
    id: 'team-strathallan',
    name: 'Strathallan Caledonian Thistle',
    shortName: 'Strathallan',
    abbreviation: 'SCT',
    colours: {
      primary: '#7A1F2B',
      secondary: '#EFE7D8',
      accent: '#FF8FA0',
      onPrimary: 'light',
    },
    kitPattern: 'stripes',
    officialBadge: null,
  },
  northmuir: {
    id: 'team-northmuir',
    name: 'Northmuir Rangers',
    shortName: 'Northmuir',
    abbreviation: 'NMR',
    colours: {
      primary: '#1B4D3E',
      secondary: '#D9F2E6',
      accent: '#5AD9A8',
      onPrimary: 'light',
    },
    kitPattern: 'hoops',
    officialBadge: null,
  },
  lochranza: {
    id: 'team-lochranza',
    name: 'Lochranza Athletic',
    shortName: 'Lochranza',
    abbreviation: 'LCH',
    colours: {
      primary: '#E4E7EC',
      secondary: '#1A1F2B',
      accent: '#8FA6C4',
      // A near-white first kit. Present on purpose: it is the one case where a
      // light monogram on the club's own colour would be unreadable.
      onPrimary: 'dark',
    },
    kitPattern: 'solid',
    officialBadge: null,
  },
  braemarnock: {
    id: 'team-braemarnock',
    name: 'Braemarnock Town',
    shortName: 'Braemarnock',
    abbreviation: 'BRT',
    colours: {
      primary: '#4A2C6F',
      secondary: '#FFD166',
      accent: '#C4A0FF',
      onPrimary: 'light',
    },
    kitPattern: 'stripes',
    officialBadge: null,
  },
  fintryhill: {
    id: 'team-fintryhill',
    name: 'Fintry Hill United',
    shortName: 'Fintry Hill',
    abbreviation: 'FHU',
    colours: {
      primary: '#B8860B',
      secondary: '#2C2C2C',
      accent: '#FFD97A',
      onPrimary: 'dark',
    },
    kitPattern: 'halves',
    officialBadge: null,
  },
  garnockside: {
    id: 'team-garnockside',
    name: 'Garnockside Victoria',
    shortName: 'Garnockside',
    abbreviation: 'GAR',
    colours: {
      primary: '#0F4C81',
      secondary: '#FFFFFF',
      accent: '#63B3ED',
      onPrimary: 'light',
    },
    kitPattern: 'solid',
    officialBadge: null,
  },
  tarbethmoor: {
    id: 'team-tarbethmoor',
    name: 'Tarbeth Moor Academical',
    shortName: 'Tarbeth Moor',
    abbreviation: 'TMA',
    colours: {
      primary: '#8C2F0D',
      secondary: '#F4E4C1',
      accent: '#FF9E6B',
      onPrimary: 'light',
    },
    kitPattern: 'hoops',
    officialBadge: null,
  },
  kilbraneth: {
    id: 'team-kilbraneth',
    name: 'Kilbraneth Star',
    shortName: 'Kilbraneth',
    abbreviation: 'KBS',
    colours: {
      primary: '#2A2E45',
      secondary: '#9BE8D8',
      accent: '#7FE3CE',
      onPrimary: 'light',
    },
    kitPattern: 'stripes',
    officialBadge: null,
  },
  ardrishmuir: {
    id: 'team-ardrishmuir',
    name: 'Ardrishmuir Juniors',
    shortName: 'Ardrishmuir',
    abbreviation: 'ARJ',
    colours: {
      primary: '#9E1B32',
      secondary: '#1C1C1C',
      accent: '#FF7A8A',
      onPrimary: 'light',
    },
    kitPattern: 'solid',
    officialBadge: null,
  },
} as const satisfies Record<string, Team>
