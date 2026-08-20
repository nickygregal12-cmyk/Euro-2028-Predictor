import { useRef } from 'react'
import { motion } from 'framer-motion'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { formatCountdown, formatDayHeading, formatDayKey } from '../foundations/format'
import surfaces from '../foundations/surfaces.module.css'
import typography from '../foundations/typography.module.css'
import type { PredictorActions, PredictorLock, PredictorModel } from '../models/predictor'
import { FixtureDecision } from './FixtureDecision'
import { MatchweekBrief } from './MatchweekBrief'
import { MatchweekOutcome } from './MatchweekOutcome'
import { useDeadlineClock } from './useDeadlineClock'
import styles from './predictor.module.css'

/**
 * vNEXT MATCH PREDICTOR — the second real page on the shell, and deliberately
 * not a second Home.
 *
 * WHAT THE PAGE IS. A working surface with its state stated beside it. The brief
 * says what matchweek this is, when it locks, how far through it you are and what
 * the Joker is doing; the list is ten decisions in a row. Nothing else is on the
 * page, because everything else is somewhere else in the product — this is the
 * one screen whose whole job is to get ten scorelines out of a player before a
 * deadline, and every region that does not serve that was left out.
 *
 * WHY IT LOOKS NOTHING LIKE HOME, ON PURPOSE. Home is state-adaptive with three
 * emphases and a cinematic stage, because Home's question is "what should I look
 * at". This page's question is "what have I not done yet", which has a completely
 * different answer: one composition, no emphasis selector, no stage, no featured
 * fixture, no ticker, no Around the Grounds, no social zone. The shell was
 * extracted in Stage 5 precisely so the second page could disagree, and this is
 * the disagreement. What it INHERITS is the language — the canvas and its
 * atmosphere, the type scale, the surface ramp, the spacing discipline, the
 * football colour idiom, the motion pairs, the container-query rule and the
 * accessibility conventions.
 *
 * THE TWO COMPOSITIONS, over one model and one markup:
 *
 *   narrow — the brief above the list, and the deadline ALSO in the shell's
 *            sticky masthead so it stays visible while scrolling without costing
 *            the viewport a second sticky band of its own;
 *   wide   — the working column and the brief side by side, the brief sticky, so
 *            the deadline, the progress and the Joker stay beside the decision
 *            being made rather than scrolling away above it.
 *
 * The wide arrangement is a rail that EARNS its column: every part of it answers
 * a question the player is asking while they type. It is not a sidebar added to
 * fill 1920.
 *
 * WHAT THIS FILE DOES NOT DO, and could not do without importing something it
 * does not import: decide whether a prediction may be edited, whether the
 * matchweek is locked, what anything is worth, whether the Joker may be played,
 * or whether a consensus may be shown. Every one of those is a field on the
 * model, put there by the adapter from the existing season authority.
 * `VNextMatchPredictor({ model, actions })` renders in Storybook and in jsdom
 * with no database, and a test holds that.
 */

export type VNextMatchPredictorProps = {
  model: PredictorModel
  actions: PredictorActions
}

export function VNextMatchPredictor({ model, actions }: VNextMatchPredictorProps) {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const stagger = useVNextMotion(vnextMotion.stagger)

  /**
   * THE INSTANT THE WHOLE PAGE IS DRAWN AGAINST, kept current.
   *
   * `model.generatedAt` is the authoritative instant and it moves only when the
   * application rebuilds the model, which is not often enough for a countdown a
   * player is watching. `useDeadlineClock` advances it by observed elapsed time
   * and, where the application says this card is open at a resolved instant, asks
   * the application again once that instant is reached.
   *
   * IT IS ONE VALUE FOR THE PAGE, deliberately: the masthead's chip, the brief's
   * countdown and every kickoff label read the same instant, so "Locks tomorrow
   * 12:00" and a row saying "Today 12:00" cannot both be on screen. And it
   * decides nothing — every control below is drawn from `model.editable`,
   * `model.lock.kind` and the Joker's own `playable`, none of which this value can
   * reach.
   */
  const displayNow = useDeadlineClock({
    generatedAt: model.generatedAt,
    lock: model.lock,
    // THE BOUNDARY COMMAND, WHICH IS NOT THE RECOVERY ONE. `reload` abandons
    // whatever this device was still writing, which is right when a player asks
    // for it and wrong when a clock does — a deadline arriving between a save
    // leaving and its replacement being queued would throw the replacement away.
    // `refreshAfterDeadline` is the application's save-safe answer to the same
    // question. vNext asks; the server answers; the answer arrives as the next
    // model.
    onBoundaryReached: actions.refreshAfterDeadline,
  })

  /**
   * THE FIRST SCORE BOX OF EVERY FIXTURE, so typing can run through a whole card
   * and the brief's jump control has somewhere to go.
   *
   * A map of live elements rather than an index: fixtures are addressed by id
   * everywhere else on this page, and a positional list would put focus on the
   * wrong club the moment a postponement changed the order.
   */
  const homeInputs = useRef(new Map<string, HTMLInputElement>())

  const focusFixture = (fixtureId: string | undefined) => {
    if (fixtureId === undefined) return
    const input = homeInputs.current.get(fixtureId)
    if (!input) return
    input.focus()
    // Centred rather than scrolled to the top: on a phone the sticky masthead
    // would otherwise cover the row the focus just landed on.
    input.scrollIntoView({ block: 'center', behavior: 'auto' })
  }

  /**
   * The next fixture that still needs a decision, AFTER a given one.
   *
   * `editable` is checked as well as the empty prediction, so a locked card
   * cannot produce a jump target and the away box's advance is inert on one. It
   * reads the model's own fields and compares nothing to a clock.
   */
  const nextOutstandingAfter = (fixtureId: string | null): string | undefined => {
    if (!model.editable) return undefined
    const start = fixtureId === null ? 0 : model.fixtures.findIndex((f) => f.id === fixtureId) + 1
    const ordered = [...model.fixtures.slice(start), ...model.fixtures.slice(0, Math.max(0, start))]
    return ordered.find((fixture) => fixture.prediction === null)?.id
  }

  const firstOutstanding = nextOutstandingAfter(null)

  return (
    <VNextShell
      // THE MATCH PREDICTOR IS A GAME, AND GAMES LIVE UNDER `games`.
      // It was `fixtures` under Stage 5's platform navigation, which had no
      // place for a game format and put the predictor beside the football. The
      // Competition Deck separates the two: Matches is this competition's
      // football, Games is what you do with it, and this page is one of three
      // things that live there.
      destination="games"
      // A FALLBACK, NOT AN INSTRUCTION — the shell takes the competition's
      // colours from its own active football context wherever an application
      // supplied one. This keeps the page renderable on its own.
      competitionColours={model.competition.colours}
      header={
        <VNextPageHeader
          title="Match Predictor"
          competition={`${model.competition.name} · ${model.competition.seasonLabel}`}
          context={`${model.matchweek.label} of ${model.matchweek.of}`}
          // THE SECOND-PAGE TEST OF `trailing`. Home puts a standing block here;
          // this puts the deadline. They have nothing in common but their
          // position, which is exactly what the slot's own comment predicted, and
          // the slot took this without a change. It also earns the page something
          // real: the masthead is already sticky, so the deadline stays on screen
          // while scrolling and the page does not need a second sticky band.
          trailing={<DeadlineChip lock={model.lock} now={displayNow} />}
        />
      }
    >
      <div className={styles.page} data-vnext-page="predictor">
        {model.notice === null ? null : (
          <motion.div
            className={`${surfaces.surface} ${styles.notice}`}
            data-tone={model.notice.tone}
            role="alert"
            variants={rise}
            initial="hidden"
            animate="visible"
          >
            <p className={`${typography.caption} ${typography.emphasis}`}>{model.notice.title}</p>
            <p className={typography.caption}>{model.notice.body}</p>
            {model.notice.retryable ? (
              <button type="button" className={styles.textAction} onClick={actions.reload}>
                Reload this matchweek
              </button>
            ) : null}
          </motion.div>
        )}

        <MatchweekBrief
          model={model}
          actions={actions}
          now={displayNow}
          onJumpToNext={firstOutstanding === undefined ? null : () => focusFixture(firstOutstanding)}
        />

        {/* THE CONTAINER EVERY ROW MEASURES ITSELF AGAINST. It is the working
            column rather than the page, because the column is narrower than the
            shell wherever the brief is beside it — and a row that composed
            against the page would be handed a width its own column does not
            have. */}
        <div className={styles.work} data-vnext-zone="work">
          {model.fixtures.length === 0 ? (
            <p className={`${surfaces.surface} ${styles.empty} ${typography.caption}`}>
              This matchweek has no fixtures published yet, so there is nothing to predict. It will
              appear here as soon as the football does.
            </p>
          ) : (
            <motion.div
              className={styles.days}
              variants={stagger}
              initial="hidden"
              animate="visible"
            >
              {groupByDay(model.fixtures).map((day) => (
                <section key={day.key} className={styles.day} aria-label={day.heading}>
                  {/* THE FOOTBALL INFORMATION ARCHITECTURE A FIXTURE LIST HAS
                      ALWAYS HAD, and the thing that stops ten rows reading as ten
                      identical cards. The heading is grouping, not state: it
                      decides no lock and no status, and it is formatted in the
                      same pinned zone as the kickoff times beneath it so the two
                      can never disagree about which day a late kickoff belongs
                      to. */}
                  <h2 className={`${typography.label} ${styles.dayHeading}`}>
                    {day.heading}
                    <span className={styles.dayCount}>{day.fixtures.length}</span>
                  </h2>

                  <ol className={styles.fixtures}>
                    {day.fixtures.map((fixture) => (
                      <FixtureDecision
                        key={fixture.id}
                        fixture={fixture}
                        enrichment={model.enrichment}
                        now={displayNow}
                        actions={actions}
                        // SELECTIVE EMPHASIS, ON EXACTLY ONE ROW. The next
                        // decision is the one thing on this list that deserves
                        // more than the row beside it; giving every fixture a
                        // cinematic treatment would destroy the hierarchy that
                        // makes a card of ten scannable at all.
                        nextUp={fixture.id === firstOutstanding}
                        onAdvanceOut={() => focusFixture(nextOutstandingAfter(fixture.id))}
                        registerHomeInput={(element) => {
                          if (element) homeInputs.current.set(fixture.id, element)
                          else homeInputs.current.delete(fixture.id)
                        }}
                      />
                    ))}
                  </ol>
                </section>
              ))}
            </motion.div>
          )}

          <MatchweekOutcome model={model} />
        </div>
      </div>
    </VNextShell>
  )
}

/**
 * THE MATCHWEEK'S FIXTURES, SPLIT INTO THE DAYS THEY ARE PLAYED ON.
 *
 * WHY GROUPING RATHER THAN A FLAT LIST. Ten equally weighted rows is a wall, and
 * a wall is what a prediction card must not be — it is how a player loses their
 * place halfway through and how a page ends up feeling like a form with football
 * logos. Every serious football product splits a matchweek by day for the same
 * reason: it is the structure the football already has, so it costs the reader
 * nothing to learn.
 *
 * IT IS LAYOUT AND NOT STATE. The key comes from `formatDayKey`, which is the same
 * pinned-zone formatter the kickoff labels use. Nothing here decides a lock, a
 * status or an order beyond the order the model already supplied — the groups come
 * out in first-appearance order, so a model that lists its fixtures in kickoff
 * order gets its days in kickoff order and this function does not sort.
 *
 * A FIXTURE WITH NO KICKOFF GETS ITS OWN LAST GROUP rather than being dropped or
 * folded into a day it is not on. Note that a matchweek containing one cannot be
 * open — `resolveLockState` fails the whole scope closed on an unparseable kickoff
 * — so this group only ever appears on a card nobody can edit.
 */
function groupByDay(
  fixtures: readonly PredictorModel['fixtures'][number][],
) {
  const groups: { key: string; heading: string; fixtures: PredictorModel['fixtures'][number][] }[] =
    []
  const byKey = new Map<string, (typeof groups)[number]>()

  for (const fixture of fixtures) {
    const key = fixture.kickoff === null ? 'unscheduled' : formatDayKey(fixture.kickoff)
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        heading:
          fixture.kickoff === null ? 'Date to be confirmed' : formatDayHeading(fixture.kickoff),
        fixtures: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.fixtures.push(fixture)
  }

  // The unscheduled group goes last wherever it appeared, because a fixture with
  // no date cannot be read as coming before one that has one.
  return [...groups.filter((g) => g.key !== 'unscheduled'), ...groups.filter((g) => g.key === 'unscheduled')]
}

/**
 * THE DEADLINE, IN THE SHELL'S OWN MASTHEAD.
 *
 * Small, because it is a status and not the brief: the label, the countdown and
 * an urgency the MODEL decided. It reads `lock.urgency` rather than comparing
 * `lock.at` to `generatedAt`, which is the rule `src/vnext/AGENTS.md` states in
 * terms — "read `urgency`, not a deadline against a clock". The countdown text is
 * formatting over two values it was handed, which is a different thing from a
 * decision.
 *
 * `aria-live` is deliberately absent, and now that the countdown advances on its
 * own that is a stronger decision rather than a weaker one: a region that
 * announced a new number every minute — over the save status a player is actually
 * waiting for — would be the page interrupting the work it exists to support. The
 * deadline is also stated in the brief, in words, where it is read on demand.
 */
function DeadlineChip({ lock, now }: { lock: PredictorLock; now: string }) {
  const countdown = lock.at === null ? null : formatCountdown(lock.at, now)

  return (
    <span className={styles.deadline} data-kind={lock.kind} data-urgency={lock.urgency ?? undefined}>
      <span className={typography.label}>{lock.label}</span>
      <span className={`${typography.caption} ${typography.numeric} ${typography.emphasis}`}>
        {lock.kind === 'open' && countdown !== null ? countdown : lock.kind === 'open' ? 'Open' : '—'}
      </span>
    </span>
  )
}
