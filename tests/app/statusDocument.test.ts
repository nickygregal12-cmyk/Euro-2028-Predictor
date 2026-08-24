import { describe, expect, it } from 'vitest'
import {
  describeMoment,
  STATUS_STYLESHEET,
  statusDocumentBody,
  statusDocumentHtml,
  summarise,
  type JourneyProbeRecord,
} from '../../src/app/site/statusDocument'

const healthy: JourneyProbeRecord = {
  checkedAt: '2026-08-24T00:42:00.000Z',
  origin: 'https://example.test',
  ok: true,
  steps: [
    { id: 'a', step: 'A stranger opens the site', path: '/', ok: true, milliseconds: 88 },
  ],
}

const broken: JourneyProbeRecord = {
  ...healthy,
  ok: false,
  steps: [
    {
      id: 'a',
      step: 'A stranger opens the site',
      path: '/',
      ok: false,
      reason: 'The landing page answered 503.',
      milliseconds: 12,
    },
  ],
}

const neverRun: JourneyProbeRecord = { checkedAt: null, origin: null, ok: null, steps: [] }

describe('the status document', () => {
  it('names the moment it describes, in UTC', () => {
    const body = statusDocumentBody(healthy, 'Predictor')
    expect(body).toContain('24 August 2026')
    expect(body).toContain('UTC')
  })

  it('survives a record that has never been written', () => {
    // The empty state is a real state: the page exists before the first run.
    const body = statusDocumentBody(neverRun, 'Predictor')
    expect(summarise(neverRun)).toBe('No check has been recorded yet.')
    expect(body).toContain('once a check has run')
    expect(body).not.toContain('Invalid Date')
  })

  it('says plainly when something was not working, and why', () => {
    const body = statusDocumentBody(broken, 'Predictor')
    expect(summarise(broken)).toMatch(/not working/)
    expect(body).toContain('The landing page answered 503.')
  })

  describe('the three things it must never do', () => {
    it('never claims to be live', () => {
      for (const record of [healthy, broken, neverRun]) {
        const body = statusDocumentBody(record, 'Predictor')
        expect(body).toContain('not a live signal')
        // A page that said "currently" or "right now" would be claiming a
        // heartbeat it does not have, and would be reassuring in exactly the
        // case somebody consults it.
        expect(body).not.toMatch(/\b(right now|currently|live status|real[- ]time)\b/i)
      }
    })

    it('never says anything about the competition', () => {
      // The line this page is one helpful-seeming sentence away from crossing.
      // Reliability instrumentation must never become a lock or scoring authority.
      //
      // The caveats are stripped before asserting, because they legitimately
      // NAME those subjects in order to disclaim them. Weakening the pattern so
      // the disclaimer could pass would have weakened it for a real claim too;
      // the reporting half is what must stay silent.
      const reportingHalf = (record: JourneyProbeRecord) =>
        statusDocumentBody(record, 'Predictor').replace(/<p class="caveat">[\s\S]*?<\/p>/g, '')

      for (const record of [healthy, broken, neverRun]) {
        const body = reportingHalf(record)
        expect(body).not.toMatch(/predictions are (open|closed)/i)
        expect(body).not.toMatch(/\b(deadline|locks at|has locked|scored|scoring|leaderboard)\b/i)
      }

      // and the caveats do say it out loud, so the next editor knows it is a rule
      const full = statusDocumentBody(healthy, 'Predictor')
      expect(full).toMatch(/says nothing about the competition/i)
      expect(full).toMatch(/whether predictions\s+are open/i)
    })

    it('carries no player data, because the record holds none to leak', () => {
      const body = statusDocumentBody(healthy, 'Predictor')
      expect(body).not.toMatch(/@/) // no address of any kind survives into the page
    })
  })

  it('escapes anything it renders, so a hostile step name cannot inject markup', () => {
    const hostile: JourneyProbeRecord = {
      ...healthy,
      steps: [
        {
          id: 'x',
          step: '<img src=x onerror="alert(1)">',
          path: '/',
          ok: false,
          reason: '</main><script>alert(2)</script>',
          milliseconds: 1,
        },
      ],
    }
    const body = statusDocumentBody(hostile, 'Predictor')
    expect(body).not.toContain('<img src=x')
    expect(body).not.toContain('<script>alert(2)')
    expect(body).toContain('&lt;img src=x')
  })

  it('reads an unparseable moment as unrecorded rather than as Invalid Date', () => {
    expect(describeMoment('not a date')).toBe('an unrecorded time')
  })
})

describe('the whole document', () => {
  const html = (href: string | null) => statusDocumentHtml(healthy, 'Predictor', href)

  it('is a complete document that stands on its own', () => {
    const body = html('/assets/style-abc123.css')
    expect(body.startsWith('<!doctype html>')).toBe(true)
    expect(body).toContain('<html lang="en-GB">')
    expect(body).toContain('<meta name="viewport"')
  })

  it('links the application stylesheet for its tokens, and its own beside it', () => {
    const body = html('/assets/style-abc123.css')
    expect(body).toContain('<link rel="stylesheet" href="/assets/style-abc123.css">')
    expect(body).toContain('<link rel="stylesheet" href="/status.css">')
  })

  it('still ships when the application stylesheet cannot be found', () => {
    // A status page that fails to render is worse than a plain one, and the
    // moment it is read is the moment the build may have gone wrong.
    const body = html(null)
    expect(body).not.toContain('/assets/')
    expect(body).toContain('<link rel="stylesheet" href="/status.css">')
    expect(body).toContain('Predictor status')
  })

  it('carries no inline style, so it survives style-src losing unsafe-inline', () => {
    expect(html('/assets/x.css')).not.toContain('<style')
  })

  it('gives every token a fallback, for the case the app stylesheet did not load', () => {
    // Each `var(--token, fallback)` must have the fallback: on this page in
    // particular, unstyled means unreadable at the worst moment.
    const declarations = [...STATUS_STYLESHEET.matchAll(/var\((--[a-z0-9-]+)([^)]*)\)/g)]
    expect(declarations.length).toBeGreaterThan(4)
    for (const declaration of declarations) {
      expect(declaration[2]?.trim().startsWith(',')).toBe(true)
    }
  })

  it('is kept out of search results', () => {
    expect(html(null)).toMatch(/name="robots"[^>]+noindex/)
  })
})
