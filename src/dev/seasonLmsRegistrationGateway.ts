import type {
  LmsRegistrationFacts,
  SeasonLmsRegistrationGateway,
} from '../features/season/lmsRegistrationModel'

/**
 * A fixture-backed gateway for season Last Man Standing registration.
 *
 * The states worth driving are the ones a healthy database will not produce on
 * demand: a window that has not opened, one that has closed, a finished
 * competition, and a server that refuses the join with the ambiguous `55000`
 * every one of its five rules shares. Waiting for a real season to reach each
 * of them is not a review strategy.
 *
 * Every scenario carries its own `serverNow`, because the panel resolves the
 * registration window against the server's instant rather than the browser's
 * clock — so a harness that supplied only the real time could not show a
 * closed window at all.
 */

export type RegistrationScenario =
  | 'open'
  | 'open_no_deadline'
  | 'not_open'
  | 'closed'
  | 'finished'
  | 'entered'
  | 'join_refused'
  | 'load_failed'

const COMPETITION_ID = 'dev-lms-competition'
const NOW = '2027-01-14T12:00:00.000Z'

function refusal(code: string, message: string) {
  // Carries the errcode PostgREST surfaces, because the classifier keys on the
  // code and a fixture without one would exercise the fallback instead of the
  // path production takes.
  return Object.assign(new Error(message), { code })
}

export function createDevSeasonLmsRegistrationGateway(
  scenario: RegistrationScenario = 'open',
): SeasonLmsRegistrationGateway {
  let entered = scenario === 'entered'

  const build = (): LmsRegistrationFacts => {
    const base = {
      competitionId: COMPETITION_ID,
      entered,
      joinedAt: entered ? '2027-01-10T09:00:00.000Z' : null,
      completedAt: null as string | null,
      serverNow: NOW,
    }

    switch (scenario) {
      case 'not_open':
        return {
          ...base,
          registrationOpensAt: '2027-02-01T09:00:00.000Z',
          registrationClosesAt: '2027-02-20T09:00:00.000Z',
        }
      case 'closed':
        return {
          ...base,
          registrationOpensAt: '2026-12-01T09:00:00.000Z',
          registrationClosesAt: '2027-01-05T09:00:00.000Z',
        }
      case 'finished':
        return {
          ...base,
          registrationOpensAt: '2026-12-01T09:00:00.000Z',
          registrationClosesAt: '2027-01-05T09:00:00.000Z',
          completedAt: '2027-01-12T21:00:00.000Z',
        }
      case 'open_no_deadline':
        return {
          ...base,
          registrationOpensAt: '2027-01-01T09:00:00.000Z',
          registrationClosesAt: null,
        }
      default:
        return {
          ...base,
          registrationOpensAt: '2027-01-01T09:00:00.000Z',
          registrationClosesAt: '2027-01-20T18:30:00.000Z',
        }
    }
  }

  return {
    async load(): Promise<LmsRegistrationFacts> {
      if (scenario === 'load_failed') {
        throw new Error('The games hub is unavailable.')
      }
      return build()
    },

    async join(): Promise<void> {
      if (scenario === 'join_refused') {
        // The code five separate server rules share. The panel must not claim
        // which one refused.
        throw refusal('55000', 'Registration has closed')
      }
      entered = true
    },
  }
}
