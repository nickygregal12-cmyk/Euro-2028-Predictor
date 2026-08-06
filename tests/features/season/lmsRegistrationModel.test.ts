import { describe, expect, it } from 'vitest'
import {
  CHAMPIONSHIP_REGISTRATION_COPY,
  LMS_REGISTRATION_COPY,
  type LmsRegistrationFacts,
  lmsRegistrationRefusal,
  presentLmsRegistration,
} from '../../../src/features/season/lmsRegistrationModel'

/**
 * Registration state comes from stored instants resolved against the SERVER's
 * clock, and the refusal classifier claims no reason it cannot know.
 */

const NOW = '2027-01-14T12:00:00.000Z'

function facts(overrides: Partial<LmsRegistrationFacts> = {}): LmsRegistrationFacts {
  return {
    competitionId: 'competition-1',
    entered: false,
    joinedAt: null,
    registrationOpensAt: '2027-01-01T09:00:00.000Z',
    registrationClosesAt: '2027-01-20T18:30:00.000Z',
    completedAt: null,
    serverNow: NOW,
    ...overrides,
  }
}

describe('presentLmsRegistration', () => {
  it('offers a join inside an open window', () => {
    const presentation = presentLmsRegistration(facts(), LMS_REGISTRATION_COPY)

    expect(presentation.state).toBe('open')
    expect(presentation.canJoin).toBe(true)
    expect(presentation.closesAt).toBe('2027-01-20T18:30:00.000Z')
  })

  it('refuses a join before the window opens, and says come back', () => {
    const presentation = presentLmsRegistration(
      facts({ registrationOpensAt: '2027-02-01T09:00:00.000Z' }),
      LMS_REGISTRATION_COPY,
    )

    expect(presentation.state).toBe('not_open')
    expect(presentation.canJoin).toBe(false)
    expect(presentation.explanation).toContain('once registration opens')
  })

  it('refuses a join after the window closes, and does not invite waiting', () => {
    const presentation = presentLmsRegistration(
      facts({ registrationClosesAt: '2027-01-05T09:00:00.000Z' }),
      LMS_REGISTRATION_COPY,
    )

    expect(presentation.state).toBe('closed')
    expect(presentation.canJoin).toBe(false)
    // The opposite advice from `not_open`: this one is not coming back.
    expect(presentation.explanation).toContain('next one')
  })

  it('treats a finished competition as finished whatever the window says', () => {
    const presentation = presentLmsRegistration(
      facts({ completedAt: '2027-01-12T21:00:00.000Z' }),
      LMS_REGISTRATION_COPY,
    )

    expect(presentation.state).toBe('finished')
    expect(presentation.canJoin).toBe(false)
  })

  it('puts membership above a closed window, because an entrant does not care', () => {
    const presentation = presentLmsRegistration(
      facts({ entered: true, registrationClosesAt: '2027-01-05T09:00:00.000Z' }),
      LMS_REGISTRATION_COPY,
    )

    expect(presentation.state).toBe('entered')
    expect(presentation.canJoin).toBe(false)
  })

  it('resolves against the server instant, not the machine running the test', () => {
    // Same stored window, two different server instants: the answer moves with
    // the server and nothing else.
    const open = presentLmsRegistration(facts({ serverNow: '2027-01-14T12:00:00.000Z' }), LMS_REGISTRATION_COPY)
    const closed = presentLmsRegistration(facts({ serverNow: '2027-02-14T12:00:00.000Z' }), LMS_REGISTRATION_COPY)

    expect(open.state).toBe('open')
    expect(closed.state).toBe('closed')
  })

  it('fails closed when no opening instant is recorded', () => {
    // The server refuses on exactly this condition, so a join button here
    // would be the surface disagreeing with the rule it describes.
    const presentation = presentLmsRegistration(facts({ registrationOpensAt: null }), LMS_REGISTRATION_COPY)

    expect(presentation.state).toBe('not_open')
    expect(presentation.canJoin).toBe(false)
  })

  it('keeps an open window joinable when no closing instant is recorded', () => {
    const presentation = presentLmsRegistration(facts({ registrationClosesAt: null }), LMS_REGISTRATION_COPY)

    expect(presentation.state).toBe('open')
    expect(presentation.canJoin).toBe(true)
    expect(presentation.closesAt).toBeNull()
  })

  it('varies only the wording per game, never the rules', () => {
    // The same facts under two games: identical state and identical
    // permission, different names. `join_competition_game` governs entry for
    // every game key, so a second copy of the logic would be a second chance
    // to disagree about one rule.
    const lms = presentLmsRegistration(facts(), LMS_REGISTRATION_COPY)
    const cup = presentLmsRegistration(facts(), CHAMPIONSHIP_REGISTRATION_COPY)

    expect(cup.state).toBe(lms.state)
    expect(cup.canJoin).toBe(lms.canJoin)
    expect(lms.headline).toBe('Join Last Man Standing')
    expect(cup.headline).toBe('Join the Predictor Championship')
    expect(cup.explanation).not.toBe(lms.explanation)
  })

  it('capitalises the game name when it opens a sentence', () => {
    const cup = presentLmsRegistration(
      facts({ completedAt: '2027-01-12T21:00:00.000Z' }),
      CHAMPIONSHIP_REGISTRATION_COPY,
    )

    expect(cup.explanation).toContain('The Predictor Championship is over')
  })
})

describe('lmsRegistrationRefusal', () => {
  it('claims no reason for 55000, which five separate server rules share', () => {
    // join_competition_game raises it for: finished, not opened, closed,
    // disqualified, and no-rejoin. Naming one would be a guess as fact.
    const sentence = lmsRegistrationRefusal({ code: '55000' })

    expect(sentence).toBe('You cannot join this competition right now.')
    expect(sentence).not.toMatch(/closed|opened|finished|disqualified/i)
  })

  it('does not inherit lmsRefusal’s elimination reading of the same code', () => {
    expect(lmsRegistrationRefusal({ code: '55000' })).not.toMatch(/eliminated/i)
  })

  it('names the cases it genuinely knows', () => {
    expect(lmsRegistrationRefusal({ code: 'unique_violation' })).toContain('already entered')
    expect(lmsRegistrationRefusal({ code: 'no_data_found' })).toContain('no longer available')
    expect(lmsRegistrationRefusal({ code: 'insufficient_privilege' })).toContain('Sign in')
  })

  it('falls back to safe generic copy for an unknown code', () => {
    const sentence = lmsRegistrationRefusal(new Error('raw internal detail'))

    expect(sentence).not.toContain('raw internal detail')
    expect(sentence.length).toBeGreaterThan(0)
  })
})
