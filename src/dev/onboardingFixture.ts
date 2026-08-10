import type { OnboardingTeam } from '../features/onboarding/OnboardingFavouriteStep'
import type { OnboardingCompetitionOffer } from '../features/onboarding/OnboardingGamesStep'

/**
 * Fixture data for the onboarding steps, shared by the gallery and the tests.
 *
 * ONE FIXTURE, TWO CONSUMERS, so a screenshot and an assertion describe the
 * same thing. It is presentation data only — the shapes the steps take as
 * props — and reaches no database.
 *
 * IT COVERS THE STATES THAT MATTER rather than a happy path: a competition
 * where a game is already joined, one where registration is closed, and one
 * that offers all three cleanly. Those are the three rows the games step has to
 * render differently, and a fixture that only held the easy case would make the
 * other two unreviewable.
 */

export const ONBOARDING_TEAMS: readonly OnboardingTeam[] = [
  { teamId: 't-celtic', name: 'Celtic', tokens: { monogram: 'CEL', primary: '#0a8754' } },
  { teamId: 't-rangers', name: 'Rangers', tokens: { monogram: 'RAN', primary: '#1b458f' } },
  { teamId: 't-hearts', name: 'Heart of Midlothian', tokens: { monogram: 'HEA', primary: '#8b2231' } },
  { teamId: 't-hibs', name: 'Hibernian', tokens: { monogram: 'HIB', primary: '#00623b' } },
  { teamId: 't-aberdeen', name: 'Aberdeen', tokens: { monogram: 'ABD', primary: '#1a4fa0' } },
  { teamId: 't-dundee', name: 'Dundee United', tokens: { monogram: 'DUN', primary: '#f4a300', onPrimary: 'dark' } },
]

const MATCH_PREDICTOR = {
  gameKey: 'main_predictor' as const,
  name: 'Match Predictor',
  description: 'Predict the score of every match in the matchweek.',
  cadence: 'Every matchweek',
  action: 'Enter a score for each fixture before the first kickoff',
}

const LAST_MAN_STANDING = {
  gameKey: 'last_man_standing' as const,
  name: 'Last Man Standing',
  description: 'Pick one club to win each round. Survive as long as you can.',
  cadence: 'Every round',
  action: 'Choose one club — you cannot pick the same club twice',
}

const CHAMPIONSHIP = {
  gameKey: 'predictor_cup' as const,
  name: 'Predictor Championship',
  description: 'A head-to-head tie each matchweek, decided by your Match Predictor points.',
  cadence: 'Every matchweek',
  action: 'Nothing extra — your predictions decide the tie',
}

export const ONBOARDING_GAME_OFFERS: readonly OnboardingCompetitionOffer[] = [
  {
    key: 'Premier League 2026/27',
    name: 'Premier League',
    games: [
      { ...MATCH_PREDICTOR, refusal: null, joined: false },
      { ...LAST_MAN_STANDING, refusal: null, joined: false },
      { ...CHAMPIONSHIP, refusal: null, joined: false },
    ],
  },
  {
    key: 'Scottish Premiership 2026/27',
    name: 'Scottish Premiership',
    games: [
      { ...MATCH_PREDICTOR, refusal: null, joined: false },
      { ...LAST_MAN_STANDING, refusal: null, joined: false },
      { ...CHAMPIONSHIP, refusal: null, joined: false },
    ],
  },
  {
    key: 'Champions League 2026/27',
    name: 'Champions League',
    games: [
      // Already a member: reported, never offered again.
      { ...MATCH_PREDICTOR, refusal: null, joined: true },
      // Closed: a sentence, never a disabled control to hover over.
      {
        ...LAST_MAN_STANDING,
        refusal: 'Registration is not open for this competition yet.',
        joined: false,
      },
      {
        ...CHAMPIONSHIP,
        refusal: 'This competition does not run a Championship.',
        joined: false,
      },
    ],
  },
]
