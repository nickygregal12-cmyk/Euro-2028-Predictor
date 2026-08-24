/**
 * First-party product events.
 *
 * The two properties worth defending are both structural, so most of these
 * assert the SHAPE rather than a behaviour: an event that cannot carry a secret
 * cannot leak one, and a function that returns nothing cannot become an
 * authority. A test that only proved "capture was called" would pass while an
 * invite code went over the wire.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../..')

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8')
}

const vocabulary = source('src/services/analytics/productEvents.ts')

describe('the vocabulary is closed', () => {
  it('names exactly the four moments the specification lists', () => {
    const names = [...vocabulary.matchAll(/^ {2}(\w+): (?:Record<string, never>|\{)/gm)].map(
      (match) => match[1],
    )
    expect(names.sort()).toEqual([
      'entry_submitted',
      'invite_opened',
      'league_joined',
      'reminders_changed',
    ])
  })

  it('lets no event carry a free string', () => {
    // THE PRIVACY GUARANTEE, and the reason it is a type rather than a rule:
    // there must be nowhere to put a display name, an email, a league name or
    // an invite code -- which this repository treats as a guessable bearer
    // token. A `string` property anywhere in this map reopens all of that.
    const map = vocabulary.slice(
      vocabulary.indexOf('type ProductEventProperties = {'),
      vocabulary.indexOf('export type ProductEventName'),
    )
    expect(map.length).toBeGreaterThan(100)
    expect(map).not.toMatch(/:\s*string\b/)
    expect(map).not.toMatch(/\[key:/)
    expect(map).not.toMatch(/Record<string,(?!\s*never\b)/)
  })

  it('returns nothing, so analytics cannot become an authority', () => {
    // The programme's binding constraint. A caller given a value will
    // eventually branch on it.
    expect(vocabulary).toMatch(/export function recordProductEvent[\s\S]*?\): void \{/)
    expect(vocabulary).not.toMatch(/export async function recordProductEvent/)
  })

  it('cannot reject into the global error handler', () => {
    // A fire-and-forget promise that rejects surfaces as an unhandled rejection,
    // and the observability layer would report an analytics hiccup as an
    // application fault.
    expect(vocabulary).toContain('.catch(() => false)')
  })
})

describe('each act counts itself', () => {
  it('counts a submission inside the service, after the server said yes', () => {
    // At the act rather than at the caller, so a future submission path cannot
    // be added that forgets to count; and after the error check, because an
    // attempt that failed is not a submission.
    const predictions = source('src/services/supabase/predictions.ts')
    const fn = predictions.slice(predictions.indexOf('export async function submitEntry'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    expect(body.indexOf('if (error) throw error')).toBeLessThan(
      body.indexOf("recordProductEvent('entry_submitted'"),
    )
  })

  it('counts a join without the code that made it possible', () => {
    const leagues = source('src/services/supabase/leagues.ts')
    const fn = leagues.slice(leagues.indexOf('export async function joinLeague'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    expect(body).toContain("recordProductEvent('league_joined', {})")
    // Nothing derived from the code goes with it.
    expect(body).not.toMatch(/recordProductEvent\([^)]*code/)
  })

  it('counts which way the reminder switch was moved, not who moved it', () => {
    const profile = source('src/services/supabase/profile.ts')
    expect(profile).toContain("recordProductEvent('reminders_changed', { enabled: reminderEmails })")
    expect(profile).not.toMatch(/recordProductEvent\([^)]*userId/)
  })

  it('counts an invitation opened once, including by a visitor with no session', () => {
    // The branch most likely to be lost. Counting only after sign-up would hide
    // exactly the drop-off the event exists to measure.
    const landing = source('src/features/leagues/JoinLandingPage.tsx')
    expect(landing).toContain("recordProductEvent('invite_opened', { signedIn: landing.kind === 'ready' })")
    expect(landing).toContain('if (counted.current')
    // Fires as soon as the landing resolves either way, not only when ready.
    expect(landing).toContain("landing.kind === 'checking') return")
  })
})

describe('startup', () => {
  const main = source('src/main.tsx')

  it('initialises analytics without making a player wait for it', () => {
    expect(main).toContain('void initProductAnalytics()')
    expect(main).not.toContain('await initProductAnalytics()')
  })
})

describe('an event recorded during startup is not lost', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.doUnmock('posthog-js')
  })

  it('waits for an initialisation already under way instead of dropping', async () => {
    // THE STARTUP WINDOW. `initProductAnalytics()` is fire-and-forget and
    // resolves asynchronously because it imports a chunk. An invite landing can
    // easily fire inside that window, and refusing there would silently
    // undercount exactly the arrivals this stage exists to count.
    vi.resetModules()
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')

    const captured: string[] = []
    let releaseImport: () => void = () => {}
    const importBlocked = new Promise<void>((resolve) => {
      releaseImport = resolve
    })

    vi.doMock('posthog-js', async () => {
      await importBlocked
      return { default: { init: () => {}, capture: (event: string) => captured.push(event) } }
    })

    const { initProductAnalytics, captureProductEvent } = await import(
      '../../src/services/analytics/productAnalytics'
    )

    // Start init, then record BEFORE it can finish.
    const initialising = initProductAnalytics()
    const duringStartup = captureProductEvent('entry_submitted', {})

    // Nothing has been captured yet -- the client does not exist.
    expect(captured).toEqual([])

    releaseImport()
    await initialising
    await expect(duringStartup).resolves.toBe(true)
    expect(captured).toEqual(['entry_submitted'])
  })

  it('still refuses when nobody ever started an initialisation', async () => {
    // Waiting must not become "initialise on first event". Analytics stays
    // opt-in: with no `initProductAnalytics()` call there is no promise to join.
    vi.resetModules()
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    vi.doMock('posthog-js', () => ({
      default: { init: () => {}, capture: () => { throw new Error('must not capture') } },
    }))
    const { captureProductEvent } = await import(
      '../../src/services/analytics/productAnalytics'
    )
    await expect(captureProductEvent('entry_submitted', {})).resolves.toBe(false)
  })
})

describe('it stays silent when unconfigured', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('sends nothing and requests nothing with no key', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    const { initProductAnalytics, captureProductEvent } = await import(
      '../../src/services/analytics/productAnalytics'
    )
    await expect(initProductAnalytics()).resolves.toBe(false)
    await expect(captureProductEvent('entry_submitted', {})).resolves.toBe(false)
  })

  it('records without throwing when nothing is configured', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    const { recordProductEvent } = await import('../../src/services/analytics/productEvents')
    expect(() => recordProductEvent('entry_submitted', {})).not.toThrow()
    expect(recordProductEvent('league_joined', {})).toBeUndefined()
  })
})
