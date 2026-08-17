import type { CompetitionRef, GameKey } from '../../models/ia'

/**
 * THE COMPETITION CATALOGUE THE STAGE 7.5 LAB IS JUDGED AGAINST.
 *
 * TWENTY, BECAUSE TWENTY IS THE BINDING TARGET. The 10 August 2026 navigation
 * authority makes "the information architecture must behave correctly at 20+
 * published competitions" an acceptance requirement rather than an aspiration,
 * and `src/dev/scaleFixture.ts` already proved the legacy model against exactly
 * that shape. This is the vNext presentation counterpart: the same argument,
 * the same size, and the same refusal to let two competitions stand in for
 * twenty. With two entries a bounded list and an unbounded one look identical.
 *
 * THE NAMES ARE REAL COMPETITIONS AND THE CLUBS ARE NOT, which is the same
 * split `fixtures/teams/teams.ts` records. A competition name is a factual
 * label a football product must be able to print; club branding carries
 * trademark and likeness obligations a mock has no business taking on.
 *
 * THE COLOURS ARE INVENTED AND MEAN NOTHING. No competition publishes a palette
 * the platform holds, so these are plausible atmosphere values for the shell's
 * competition wash — never an identity claim, and never a data source.
 *
 * THREE OF THEM ARE DELIBERATELY LONG. "Union of European Football Associations
 * Champions League", "Scottish Championship Play-Off Semi-Final" and "National
 * Women's Soccer League Championship" exist so a switcher, a chip and a rail
 * row are tested against the worst realistic string rather than the shortest.
 * Nothing here may be truncated by a concept.
 */

type CatalogueSeed = {
  readonly id: string
  readonly name: string
  readonly shortName: string
  readonly monogram: string
  readonly seasonLabel: string | null
  readonly primary: string
  readonly accent: string
  readonly onPrimary: 'light' | 'dark'
  /** Which games this competition RUNS. Not what any player has joined. */
  readonly offers: readonly GameKey[]
}

const ALL: readonly GameKey[] = ['match-predictor', 'last-man-standing', 'championship']
const PREDICTOR_AND_LMS: readonly GameKey[] = ['match-predictor', 'last-man-standing']
const PREDICTOR_ONLY: readonly GameKey[] = ['match-predictor']

/**
 * WHICH GAMES A COMPETITION RUNS IS NOT UNIFORM, AND THAT IS THE POINT.
 *
 * `get_competition_games` is the server's answer per season, so a frontend that
 * assumed every competition runs all three would be inventing availability. The
 * seeds below vary deliberately: a knockout cup runs no season-long
 * Championship, and a short tournament runs neither it nor Last Man Standing.
 * §7 of the Stage 7.5 brief asks every concept to prove what happens then.
 */
const SEEDS: readonly CatalogueSeed[] = [
  {
    id: 'premier-league',
    name: 'Premier League',
    shortName: 'Premier League',
    monogram: 'PL',
    seasonLabel: '2026/27',
    primary: '#38003C',
    accent: '#E6007E',
    onPrimary: 'light',
    offers: ALL,
  },
  {
    id: 'scottish-premiership',
    name: 'Scottish Premiership',
    shortName: 'Premiership',
    monogram: 'SP',
    seasonLabel: '2026/27',
    primary: '#0B3D6B',
    accent: '#4FA3FF',
    onPrimary: 'light',
    offers: ALL,
  },
  {
    id: 'champions-league',
    name: 'Union of European Football Associations Champions League',
    shortName: 'Champions League',
    monogram: 'CL',
    seasonLabel: '2026/27',
    primary: '#0A1A4A',
    accent: '#7FA8FF',
    onPrimary: 'light',
    offers: PREDICTOR_AND_LMS,
  },
  {
    id: 'euro-2028',
    name: 'Euro 2028',
    shortName: 'Euro 2028',
    monogram: 'E8',
    seasonLabel: null,
    primary: '#123C2A',
    accent: '#3DDC84',
    onPrimary: 'light',
    offers: PREDICTOR_ONLY,
  },
  {
    id: 'championship',
    name: 'Championship',
    shortName: 'Championship',
    monogram: 'CH',
    seasonLabel: '2026/27',
    primary: '#1E2A4A',
    accent: '#8FC0FF',
    onPrimary: 'light',
    offers: ALL,
  },
  {
    id: 'league-one',
    name: 'League One',
    shortName: 'League One',
    monogram: 'L1',
    seasonLabel: '2026/27',
    primary: '#2A3550',
    accent: '#9FB4E8',
    onPrimary: 'light',
    offers: PREDICTOR_AND_LMS,
  },
  {
    id: 'league-two',
    name: 'League Two',
    shortName: 'League Two',
    monogram: 'L2',
    seasonLabel: '2026/27',
    primary: '#2E3A44',
    accent: '#A9C4D6',
    onPrimary: 'light',
    offers: PREDICTOR_AND_LMS,
  },
  {
    id: 'scottish-championship',
    name: 'Scottish Championship Play-Off Semi-Final',
    shortName: 'Scottish Play-Off',
    monogram: 'SC',
    seasonLabel: '2026/27',
    primary: '#123244',
    accent: '#5FD0E8',
    onPrimary: 'light',
    offers: PREDICTOR_ONLY,
  },
  {
    id: 'fa-cup',
    name: 'FA Cup',
    shortName: 'FA Cup',
    monogram: 'FA',
    seasonLabel: '2026/27',
    primary: '#3A1030',
    accent: '#FF7AB8',
    onPrimary: 'light',
    offers: PREDICTOR_AND_LMS,
  },
  {
    id: 'scottish-cup',
    name: 'Scottish Cup',
    shortName: 'Scottish Cup',
    monogram: 'SU',
    seasonLabel: '2026/27',
    primary: '#14304E',
    accent: '#6BB8FF',
    onPrimary: 'light',
    offers: PREDICTOR_ONLY,
  },
  {
    id: 'efl-cup',
    name: 'EFL Cup',
    shortName: 'EFL Cup',
    monogram: 'EC',
    seasonLabel: '2026/27',
    primary: '#31234E',
    accent: '#B79CFF',
    onPrimary: 'light',
    offers: PREDICTOR_ONLY,
  },
  {
    id: 'la-liga',
    name: 'La Liga',
    shortName: 'La Liga',
    monogram: 'LL',
    seasonLabel: '2026/27',
    primary: '#4A1220',
    accent: '#FF8A6B',
    onPrimary: 'light',
    offers: ALL,
  },
  {
    id: 'serie-a',
    name: 'Serie A',
    shortName: 'Serie A',
    monogram: 'SA',
    seasonLabel: '2026/27',
    primary: '#0E2C46',
    accent: '#69C9F5',
    onPrimary: 'light',
    offers: ALL,
  },
  {
    id: 'bundesliga',
    name: 'Bundesliga',
    shortName: 'Bundesliga',
    monogram: 'BL',
    seasonLabel: '2026/27',
    primary: '#3E1414',
    accent: '#FF6B6B',
    onPrimary: 'light',
    offers: PREDICTOR_AND_LMS,
  },
  {
    id: 'ligue-1',
    name: 'Ligue 1',
    shortName: 'Ligue 1',
    monogram: 'L1F',
    seasonLabel: '2026/27',
    primary: '#132A44',
    accent: '#75B6FF',
    onPrimary: 'light',
    offers: PREDICTOR_AND_LMS,
  },
  {
    id: 'eredivisie',
    name: 'Eredivisie',
    shortName: 'Eredivisie',
    monogram: 'ER',
    seasonLabel: '2026/27',
    primary: '#4A2A0E',
    accent: '#FFA85C',
    onPrimary: 'light',
    offers: PREDICTOR_ONLY,
  },
  {
    id: 'primeira-liga',
    name: 'Primeira Liga',
    shortName: 'Primeira Liga',
    monogram: 'PR',
    seasonLabel: '2026/27',
    primary: '#0E3A2C',
    accent: '#4FE0A8',
    onPrimary: 'light',
    offers: PREDICTOR_ONLY,
  },
  {
    id: 'europa-league',
    name: 'Europa League',
    shortName: 'Europa League',
    monogram: 'EL',
    seasonLabel: '2026/27',
    primary: '#3A2A08',
    accent: '#FFCE4A',
    onPrimary: 'light',
    offers: PREDICTOR_AND_LMS,
  },
  {
    id: 'wsl',
    name: "Women's Super League",
    shortName: 'WSL',
    monogram: 'WS',
    seasonLabel: '2026/27',
    primary: '#2C1240',
    accent: '#CE8CFF',
    onPrimary: 'light',
    offers: ALL,
  },
  {
    id: 'nwsl',
    name: "National Women's Soccer League Championship",
    shortName: 'NWSL',
    monogram: 'NW',
    seasonLabel: '2026',
    primary: '#123048',
    accent: '#6FD2FF',
    onPrimary: 'light',
    offers: PREDICTOR_AND_LMS,
  },
]

function refOf(seed: CatalogueSeed): CompetitionRef {
  return {
    id: seed.id,
    name: seed.name,
    shortName: seed.shortName,
    monogram: seed.monogram,
    seasonLabel: seed.seasonLabel,
    colours: {
      primary: seed.primary,
      accent: seed.accent,
      onPrimary: seed.onPrimary,
    },
  }
}

/** Every competition the fixture platform publishes, in catalogue order. */
export const iaCompetitions: readonly CompetitionRef[] = SEEDS.map(refOf)

/**
 * What each competition RUNS, keyed by id. The server's answer, mocked.
 *
 * Not exported: `iaOffers` is the accessor, and it throws on an unknown id
 * rather than returning `undefined` for a competition that does not exist.
 */
const iaCompetitionOffers: Readonly<Record<string, readonly GameKey[]>> =
  Object.fromEntries(SEEDS.map((seed) => [seed.id, seed.offers]))

/**
 * One competition by id, or a thrown error.
 *
 * DELIBERATELY LOUD. A fixture that silently returned a placeholder for an
 * unknown id would let a scenario name a competition that does not exist and
 * still render, which is the class of defect this whole lane exists to avoid.
 */
export function iaCompetition(id: string): CompetitionRef {
  const found = iaCompetitions.find((entry) => entry.id === id)
  if (!found) throw new Error(`Unknown fixture competition: ${id}`)
  return found
}

export function iaOffers(id: string): readonly GameKey[] {
  const found = iaCompetitionOffers[id]
  if (!found) throw new Error(`Unknown fixture competition: ${id}`)
  return found
}
