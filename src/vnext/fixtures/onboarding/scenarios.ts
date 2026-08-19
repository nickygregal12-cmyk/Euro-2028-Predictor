import type { OnboardingModel, OnboardingView } from '../../models/onboarding'

/**
 * ONBOARDING'S DETERMINISTIC WORLDS.
 *
 * EVERY WORLD IS A STATE THE MAPPER CAN PRODUCE. `tests/vnext/onboarding.test.tsx`
 * asserts the pairing rules over all of them at once, so a world cannot be
 * added in a shape the four steps cannot reach — a fixture depicting a payload
 * the server cannot emit is how Stage 10 got four layers of green tests over
 * one impossible page.
 *
 * NOTHING IS PRE-TICKED except where the world exists to show a returning
 * player, and no game is both `joined` and `chosen`: already-joined games carry
 * no control, so nothing can have ticked one.
 *
 * NO CLOCK.
 */

const NOW = '2027-06-01T12:00:00.000Z'

/**
 * The model inside a ready world, so a variant can be written as "that world,
 * with this one thing different" rather than as a copy of it. A copy is how two
 * worlds start disagreeing about how many steps there are.
 */
function modelOf(view: OnboardingView): OnboardingModel {
  if (view.kind !== 'ready') throw new Error('not a ready world')
  return view.model
}

const onboardingLoading: OnboardingView = { kind: 'loading' }

const onboardingUnavailable: OnboardingView = {
  kind: 'unavailable',
  message:
    'We could not load the competitions to choose from. Your account is fine — this is our end.',
}

const NOTE =
  'Following a competition only decides what you see. It does not enter you into any of its games — you choose those next.'

/** Step one, nothing chosen — what a brand-new account actually sees. */
const onboardingFirstStep: OnboardingView = {
  kind: 'ready',
  model: {
    greeting: 'Welcome, Ada',
    position: 1,
    total: 4,
    back: false,
    isLast: false,
    commit: { kind: 'idle' },
    generatedAt: NOW,
    panel: {
      step: 'competitions',
      note: NOTE,
      offers: [
        {
          key: 'Caledonian Premiership 2027/28',
          name: 'Caledonian Premiership',
          seasonLabel: '2027/28',
          summary: 'Twelve clubs, thirty-eight matchweeks.',
          followed: false,
          games: [],
        },
        {
          key: 'Harbour League 2027/28',
          name: 'Harbour League',
          seasonLabel: '2027/28',
          summary: 'A shorter season, played on Saturdays.',
          followed: false,
          games: [],
        },
      ],
    },
  },
}

/** Nothing published yet. Following nothing is still a complete outcome. */
const onboardingNothingPublished: OnboardingView = {
  kind: 'ready',
  model: {
    ...modelOf(onboardingFirstStep),
    panel: { step: 'competitions', note: NOTE, offers: [] },
  },
}

/** A returning player, resumed on step one with their follow already on. */
const onboardingResumed: OnboardingView = {
  kind: 'ready',
  model: {
    ...modelOf(onboardingFirstStep),
    panel: {
      step: 'competitions',
      note: NOTE,
      offers: [
        {
          key: 'Caledonian Premiership 2027/28',
          name: 'Caledonian Premiership',
          seasonLabel: '2027/28',
          summary: 'Twelve clubs, thirty-eight matchweeks.',
          followed: true,
          games: [],
        },
      ],
    },
  },
}

/** The favourite step, with one competition's clubs read and one still out. */
const onboardingClubs: OnboardingView = {
  kind: 'ready',
  model: {
    greeting: 'Welcome, Ada',
    position: 2,
    total: 4,
    back: true,
    isLast: false,
    commit: { kind: 'idle' },
    generatedAt: NOW,
    panel: {
      step: 'clubs',
      groups: [
        {
          key: 'Caledonian Premiership 2027/28',
          competitionName: 'Caledonian Premiership',
          clubs: [
            { teamId: 'club-1', name: 'Ardrossan Athletic', chosen: true },
            { teamId: 'club-2', name: 'Barrahead Rovers', chosen: false },
            { teamId: 'club-3', name: 'Carrick Thistle', chosen: false },
          ],
        },
        {
          key: 'Harbour League 2027/28',
          competitionName: 'Harbour League',
          clubs: null,
        },
      ],
    },
  },
}

/** Followed nothing, so there is nothing to choose a club from. */
const onboardingNoClubs: OnboardingView = {
  kind: 'ready',
  model: {
    ...modelOf(onboardingClubs),
    panel: { step: 'clubs', groups: [] },
  },
}

/**
 * The games step, holding all three of the offer states at once: choosable,
 * already joined, and not opened by this competition.
 */
const onboardingGames: OnboardingView = {
  kind: 'ready',
  model: {
    greeting: 'Welcome, Ada',
    position: 3,
    total: 4,
    back: true,
    isLast: false,
    commit: { kind: 'idle' },
    generatedAt: NOW,
    panel: {
      step: 'games',
      offers: [
        {
          key: 'Caledonian Premiership 2027/28',
          name: 'Caledonian Premiership',
          seasonLabel: '2027/28',
          summary: 'Twelve clubs, thirty-eight matchweeks.',
          followed: true,
          games: [
            {
              gameKey: 'main_predictor',
              name: 'Match Predictor',
              description: 'Predict every score before the matchweek locks.',
              cadence: 'Every matchweek',
              joined: false,
              chosen: true,
              refusal: null,
            },
            {
              gameKey: 'last_man_standing',
              name: 'Last Man Standing',
              description: 'Pick one club to win. Get it wrong and you are out.',
              cadence: 'One pick a round',
              joined: true,
              chosen: false,
              refusal: null,
            },
            {
              gameKey: 'predictor_cup',
              name: 'Predictor Championship',
              description: 'A knockout played over the season.',
              cadence: 'Two legs a tie',
              joined: false,
              chosen: false,
              refusal: 'This competition has not opened this game yet.',
            },
          ],
        },
      ],
    },
  },
}

/** On the games step having followed nothing. */
const onboardingNoGames: OnboardingView = {
  kind: 'ready',
  model: {
    ...modelOf(onboardingGames),
    panel: { step: 'games', offers: [] },
  },
}

/** The review, with all three lists filled. */
const onboardingReview: OnboardingView = {
  kind: 'ready',
  model: {
    greeting: 'Welcome, Ada',
    position: 4,
    total: 4,
    back: true,
    isLast: true,
    commit: { kind: 'idle' },
    generatedAt: NOW,
    panel: {
      step: 'review',
      summary: {
        follows: ['Caledonian Premiership', 'Harbour League'],
        clubs: [{ competition: 'Caledonian Premiership', club: 'Ardrossan Athletic' }],
        games: [{ competition: 'Caledonian Premiership', game: 'Match Predictor' }],
        empty: false,
      },
    },
  },
}

/** Chose nothing at all. A complete and perfectly ordinary outcome. */
const onboardingReviewEmpty: OnboardingView = {
  kind: 'ready',
  model: {
    ...modelOf(onboardingReview),
    panel: {
      step: 'review',
      summary: { follows: [], clubs: [], games: [], empty: true },
    },
  },
}

/** The commit is in flight. */
const onboardingSaving: OnboardingView = {
  kind: 'ready',
  model: {
    ...modelOf(onboardingReview),
    commit: { kind: 'working' },
  },
}

/** Part of it was refused, and onboarding is over anyway. */
const onboardingPartial: OnboardingView = {
  kind: 'ready',
  model: {
    ...modelOf(onboardingReview),
    commit: {
      kind: 'partial',
      refused: ['Match Predictor in Caledonian Premiership'],
    },
  },
}

/** The whole commit failed. */
const onboardingFailed: OnboardingView = {
  kind: 'ready',
  model: {
    ...modelOf(onboardingReview),
    commit: {
      kind: 'failed',
      message: 'We could not finish your setup. Please try again.',
    },
  },
}

export const onboardingScenarios = {
  loading: onboardingLoading,
  unavailable: onboardingUnavailable,
  firstStep: onboardingFirstStep,
  nothingPublished: onboardingNothingPublished,
  resumed: onboardingResumed,
  clubs: onboardingClubs,
  noClubs: onboardingNoClubs,
  games: onboardingGames,
  noGames: onboardingNoGames,
  review: onboardingReview,
  reviewEmpty: onboardingReviewEmpty,
  saving: onboardingSaving,
  partial: onboardingPartial,
  failed: onboardingFailed,
} as const

export type OnboardingScenarioName = keyof typeof onboardingScenarios

export const onboardingScenarioNames = Object.keys(
  onboardingScenarios,
) as OnboardingScenarioName[]

export const onboardingScenarioPremises: Readonly<
  Record<OnboardingScenarioName, string>
> = {
  loading: 'Before the catalogue answered. It says what it is loading, rather than showing four empty steps.',
  unavailable:
    'The catalogue read failed. Onboarding cannot ask its first question, and says so without blaming the account.',
  firstStep:
    'A brand-new account on step one. NOTHING is pre-ticked, and the sentence people misread — following is not entering — is on the step where they misread it.',
  nothingPublished:
    'Nothing is published to follow. Following nothing is a complete outcome, so the step says so and still moves on.',
  resumed:
    'A returning player. The follow they already made comes back ticked, from contract 157 rather than from anything remembered in the browser.',
  clubs:
    'The favourite step, with one competition’s clubs read and one still outstanding. "Not read yet" and "no clubs" are drawn differently on purpose.',
  noClubs: 'On the club step having followed nothing. There is nothing to choose from, and it says that rather than drawing an empty list.',
  games:
    'THE binding world. All three offer states at once: one choosable, one ALREADY JOINED — a server fact with no control — and one the competition has not opened, stated rather than hidden.',
  noGames: 'On the games step having followed nothing. Games belong to a competition.',
  review:
    'The review, with the three choices listed APART. They are three server authorities and one can be refused while the others go through.',
  reviewEmpty:
    'Chose nothing at all. A valid, complete outcome, and the page says so without a hint of disappointment.',
  saving: 'The host’s commit is in flight. One control, busy, and no second submission.',
  partial:
    'Some of the setup was refused and the rest was saved. Onboarding is over either way — the page names what did not happen and still lets the player leave.',
  failed: 'The whole commit failed. Said once, and the player can try again.',
}
