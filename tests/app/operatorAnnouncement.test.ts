/**
 * The operator announcement is the one string on the page written outside the
 * codebase, so every test here is about a REFUSAL. A banner that renders
 * nothing is a correct outcome; a half-rendered maintenance notice, an expired
 * one still greeting players, or a message that brought an element with it are
 * not.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  activeAnnouncement,
  MAX_MESSAGE_LENGTH,
} from '../../src/app/site/operatorAnnouncement'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const NOW = Date.parse('2026-08-24T12:00:00.000Z')

function published(overrides: Record<string, unknown> = {}) {
  return {
    message: 'Results for matchweek 3 are delayed while we check a correction.',
    level: 'info',
    publishedAt: '2026-08-24T11:00:00.000Z',
    expiresAt: '2026-08-25T11:00:00.000Z',
    ...overrides,
  }
}

describe('what the operator published', () => {
  it('shows a live message at its level', () => {
    expect(activeAnnouncement(published({ level: 'warning' }), NOW)).toEqual({
      message: 'Results for matchweek 3 are delayed while we check a correction.',
      level: 'warning',
    })
  })

  it('trims the message, because a dispatch input collects stray whitespace', () => {
    expect(activeAnnouncement(published({ message: '  Maintenance at 21:00.  ' }), NOW))
      .toEqual({ message: 'Maintenance at 21:00.', level: 'info' })
  })
})

describe('what it refuses', () => {
  it('shows nothing for the empty record this repository normally holds', () => {
    const empty = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'config/operator-announcement.json'), 'utf8'),
    )
    // The committed default must be silent. If this ever fails, an
    // announcement was left behind in the repository.
    expect(activeAnnouncement(empty, NOW)).toBeNull()
  })

  it('shows nothing once it has expired', () => {
    // The whole point of the expiry: a maintenance notice must not still be
    // greeting players a week later because nobody withdrew it.
    const expiry = Date.parse('2026-08-25T11:00:00.000Z')
    expect(activeAnnouncement(published(), expiry - 1)).not.toBeNull()
    expect(activeAnnouncement(published(), expiry)).toBeNull()
    expect(activeAnnouncement(published(), expiry + 1)).toBeNull()
  })

  it('treats a missing or unparseable expiry as broken, not as permanent', () => {
    // "Forever" is never what an operator means by a service message.
    //
    // Honest note on what this does and does not prove. The refusal is real and
    // asserted here. But deleting the explicit `expiry === null` line does NOT
    // turn this red, because `null <= now` coerces to `0 <= now` and refuses by
    // accident -- so the outcome survives for the wrong reason. What actually
    // holds that line in place is the COMPILER: without it, `expiry` is
    // `number | null` at the comparison and tsc reports TS18047. That is a
    // stronger guarantee than this test, and worth writing down so nobody
    // "simplifies" the line away on the strength of a green suite.
    expect(activeAnnouncement(published({ expiresAt: null }), NOW)).toBeNull()
    expect(activeAnnouncement(published({ expiresAt: 'not a date' }), NOW)).toBeNull()
    expect(activeAnnouncement(published({ expiresAt: '' }), NOW)).toBeNull()
  })

  it('refuses an over-long message whole rather than truncating it', () => {
    // Half a sentence can say something the operator did not write.
    const atCap = 'a'.repeat(MAX_MESSAGE_LENGTH)
    expect(activeAnnouncement(published({ message: atCap }), NOW)).not.toBeNull()
    expect(activeAnnouncement(published({ message: `${atCap}a` }), NOW)).toBeNull()
  })

  it('refuses a level it does not know', () => {
    for (const level of [null, '', 'INFO', 'error', 'critical', 'danger', 7]) {
      expect(activeAnnouncement(published({ level }), NOW), String(level)).toBeNull()
    }
  })

  it('refuses an empty or whitespace message', () => {
    for (const message of [null, '', '   ', '\n\t', 42]) {
      expect(activeAnnouncement(published({ message }), NOW), String(message)).toBeNull()
    }
  })

  it('survives a record that is not a record at all', () => {
    // A malformed file must render nothing, never throw and take the shell
    // down with it.
    for (const record of [null, undefined, 'a string', 42, [], true]) {
      expect(() => activeAnnouncement(record, NOW)).not.toThrow()
      expect(activeAnnouncement(record, NOW)).toBeNull()
    }
  })
})

describe('the message cannot bring markup with it', () => {
  it('passes tags through as text for React to escape', () => {
    // The parser deliberately does NOT strip or sanitise: it returns the
    // characters unchanged and the component renders them as a text child, so
    // escaping happens once, in the place that actually knows the output
    // context. A stripper here would be a second, weaker answer.
    const hostile = '<img src=x onerror="alert(1)"> and <script>alert(2)</script>'
    expect(activeAnnouncement(published({ message: hostile }), NOW)).toEqual({
      message: hostile,
      level: 'info',
    })
  })

  it('renders the message as a text child, never as html', () => {
    const component = readFileSync(
      resolve(repositoryRoot, 'src/app/OperatorAnnouncement.tsx'),
      'utf8',
    )
    expect(component).toContain('{announcement.message}')
    expect(component).not.toContain('dangerouslySetInnerHTML')
  })
})

describe('the operator control', () => {
  const workflow = readFileSync(
    resolve(repositoryRoot, '.github/workflows/operator-announcement.yml'),
    'utf8',
  )

  it('can withdraw as well as publish', () => {
    // Taking a message down must be as easy as putting one up, and must not
    // mean editing JSON by hand.
    expect(workflow).toContain('- withdraw')
    expect(workflow).toContain("action === 'withdraw'")
  })

  it('refuses to push anything but the announcement record', () => {
    // A job with write access to the default branch must be unable to carry
    // anything else along.
    expect(workflow).toContain(
      "git status --porcelain -- . ':!config/operator-announcement.json'",
    )
    expect(workflow).toContain('refusing to push')
  })

  it('composes the record with a JSON serialiser, not with shell strings', () => {
    // The message is operator free text and may contain quotes, newlines and
    // backslashes. Building JSON by interpolation corrupts the file on the
    // first apostrophe.
    expect(workflow).toContain('JSON.stringify')
  })

  it('applies the same length cap the reader applies', () => {
    // Otherwise the operator learns the message was too long by watching it
    // fail to appear after a deploy.
    expect(workflow).toContain('message.length > 280')
    expect(MAX_MESSAGE_LENGTH).toBe(280)
  })

  it('bounds how long an announcement may live', () => {
    expect(workflow).toContain('hours < 1 || hours > 168')
  })

  it('rebases rather than forcing when main has moved', () => {
    expect(workflow).toContain('git pull --rebase origin main')
    expect(workflow).not.toContain('--force')
  })

  it('claims a commit only after the push actually succeeded', () => {
    // THE FALSE-SUCCESS CHANNEL. A rejected push leaves the newly composed text
    // in a workspace file nobody else can see; printing that under "the
    // committed record" is how an operator walks away believing a maintenance
    // notice is live when it is not. This repository closed the same hole in
    // the journey probe once already.
    const summary = workflow.slice(workflow.indexOf('Say what actually happened'))

    // `pushed` is set inside the success branch of the push loop, not beside it.
    const commitStep = workflow.slice(
      workflow.indexOf('- name: Commit it'),
      workflow.indexOf('- name: Say what actually happened'),
    )
    const pushSucceeded = commitStep.indexOf('if git push origin HEAD:main; then')
    const marksPushed = commitStep.indexOf("echo 'pushed=true'")
    expect(pushSucceeded).toBeGreaterThan(-1)
    expect(marksPushed).toBeGreaterThan(pushSucceeded)

    // The summary decides on that output, and reads the COMMIT rather than the
    // workspace, so it cannot show text that was never pushed.
    expect(summary).toContain("[ \"${PUSHED:-}\" = 'true' ]")
    expect(summary).toContain('git show HEAD:config/operator-announcement.json')
    expect(summary).not.toContain('cat config/operator-announcement.json')

    // And it says so plainly when nothing landed.
    expect(summary).toContain('NOTHING WAS COMMITTED')
  })
})
