/**
 * THE STATUS DOCUMENT, AND THE THREE THINGS IT MUST NOT DO.
 *
 * It renders the most recent recorded run of the synthetic journey probe
 * (`scripts/journey-probe/`). It is deliberately small, deliberately static, and
 * deliberately modest about what it knows.
 *
 * 1. IT NEVER CLAIMS TO BE LIVE. It is built from a committed record, so it
 *    describes the moment that record names and no other. A page that implied a
 *    heartbeat while served from the very origin it reports on would be lying in
 *    the one case anybody consults it — and it would be lying reassuringly, which
 *    is worse than being wrong.
 *
 * 2. IT NEVER SAYS ANYTHING ABOUT THE GAME. Not whether predictions are open,
 *    not whether a matchweek has locked, not whether anything scored. The
 *    programme's rule is that reliability instrumentation never becomes result,
 *    scoring, lock or membership authority, and a status page is exactly where
 *    that line gets crossed by accident: "predictions are open" is one helpful-
 *    seeming sentence away, and a player who believed it over the real lock would
 *    have been misled by a page whose whole purpose is to be trusted.
 *
 * 3. IT CARRIES NO PLAYER DATA. The record holds check names, outcomes,
 *    durations and an origin. Nothing about anybody.
 *
 * Pure: a record in, a string out.
 */

type JourneyStepRecord = {
  readonly id: string
  readonly step: string
  readonly path: string
  readonly ok: boolean
  readonly reason?: string
  readonly milliseconds: number
}

export type JourneyProbeRecord = {
  readonly checkedAt: string | null
  readonly origin: string | null
  readonly ok: boolean | null
  readonly steps: readonly JourneyStepRecord[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** "24 August 2026 at 00:42 UTC" — a moment a person reads, always in UTC so it
 *  cannot appear to be a different time to a reader in a different place. */
export function describeMoment(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'an unrecorded time'
  const date = at.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const time = at.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
  return `${date} at ${time} UTC`
}

/** The one-line summary, which must survive a record that has never been written. */
export function summarise(record: JourneyProbeRecord): string {
  if (record.checkedAt === null || record.ok === null) {
    return 'No check has been recorded yet.'
  }
  return record.ok
    ? 'Everything the check covers was working.'
    : 'Something the check covers was not working.'
}

export function statusDocumentBody(record: JourneyProbeRecord, productName: string): string {
  const rows = record.steps
    .map((step) => {
      const mark = step.ok ? '✓' : '✕'
      const reason = step.reason ? `<p class="reason">${escapeHtml(step.reason)}</p>` : ''
      return `      <li class="step ${step.ok ? 'ok' : 'broken'}">
        <span class="mark" aria-hidden="true">${mark}</span>
        <span class="what"><span class="sr-only">${step.ok ? 'Working: ' : 'Not working: '}</span>${escapeHtml(step.step)}</span>
        ${reason}
      </li>`
    })
    .join('\n')

  const when =
    record.checkedAt === null
      ? '<p class="when">This page will name the moment once a check has run.</p>'
      : `<p class="when">Checked ${escapeHtml(describeMoment(record.checkedAt))}.</p>`

  const stepList =
    record.steps.length === 0
      ? '<p class="empty">Nothing has been recorded to show here yet.</p>'
      : `<ul class="steps">\n${rows}\n    </ul>`

  return `    <main class="status">
      <h1>${escapeHtml(productName)} status</h1>
      <p class="summary">${escapeHtml(summarise(record))}</p>
      ${when}
      ${stepList}
      <p class="caveat">
        This is a record of the last automated check, not a live signal. It is
        written when the check runs and published with the next deploy, so a very
        recent problem may not appear here yet.
      </p>
      <p class="caveat">
        It says nothing about the competition itself &mdash; whether predictions
        are open, when a deadline falls, or how anything scored. Those live in the
        app, which is the only place they are ever correct.
      </p>
      <p class="back"><a href="/">Back to ${escapeHtml(productName)}</a></p>
    </main>`
}

/**
 * The page's own stylesheet.
 *
 * A separate file rather than an inline `<style>`: the enforced policy still
 * allows `style-src 'unsafe-inline'`, but the report-only policy beside it and
 * the register's mitigation are both aimed at removing it, and a new page that
 * only works while that permission survives is a page that breaks on the day
 * somebody finally earns its removal.
 *
 * Every token carries a fallback, so the page is legible even if the app's
 * stylesheet fails to load — which, on a status page, is precisely the moment it
 * has to stay readable.
 */
export const STATUS_STYLESHEET = `:root {
  /* DARK, DELIBERATELY, AND NOT "light dark".
     The app's tokens switch on a [data-theme] attribute the ThemeProvider sets
     from a stored choice. A static document cannot read that store, so it always
     receives the :root (dark) values — declaring "light dark" would then hand a
     light-preferring browser light scrollbars and controls around a dark page.
     Dark also matches what a first-time visitor sees in the app itself. */
  color-scheme: dark;
}
body {
  margin: 0;
  background: var(--bg, #10131a);
  color: var(--tx, #f2f5f9);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  line-height: 1.5;
}
.status { max-width: 34rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
.status h1 { font-size: 1.5rem; line-height: 1.25; margin: 0 0 0.75rem; }
.summary { font-size: 1.125rem; margin: 0 0 0.25rem; }
.when { color: var(--tx2, #b9c2cf); margin: 0 0 1.75rem; }
.steps { list-style: none; margin: 0 0 1.75rem; padding: 0; }
.step {
  display: grid;
  grid-template-columns: 1.5rem 1fr;
  gap: 0.5rem;
  align-items: start;
  padding: 0.6rem 0;
  border-top: 1px solid var(--mut, #262b36);
}
.step:last-child { border-bottom: 1px solid var(--mut, #262b36); }
.mark { font-weight: 700; }
.step.ok .mark { color: var(--acc, #7bd88f); }
.step.broken .mark { color: #ff6b6b; }
.reason { grid-column: 2; margin: 0.35rem 0 0; color: var(--tx2, #b9c2cf); }
.empty, .caveat { color: var(--tx2, #b9c2cf); margin: 0 0 1rem; }
.back { margin-top: 2rem; }
.back a { color: var(--acc, #7bd88f); }
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0;
  margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
@media (min-width: 40rem) { .status { padding-top: 4rem; } }
`

export const STATUS_DOCUMENT_PATH = '/status.html'
export const STATUS_STYLESHEET_PATH = '/status.css'

/** The whole document. `appStylesheetHref` brings the design tokens with it. */
export function statusDocumentHtml(
  record: JourneyProbeRecord,
  productName: string,
  appStylesheetHref: string | null,
): string {
  const tokens = appStylesheetHref
    ? `\n    <link rel="stylesheet" href="${escapeHtml(appStylesheetHref)}">`
    : ''

  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(productName)} status</title>
    <meta name="robots" content="noindex, nofollow">${tokens}
    <link rel="stylesheet" href="${STATUS_STYLESHEET_PATH}">
  </head>
  <body>
${statusDocumentBody(record, productName)}
  </body>
</html>
`
}
