import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextChampionship } from '../championship/VNextChampionship'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import { championshipScenarioPremises, championshipScenarios, shellScenarios } from '../fixtures'
import type { ChampionshipScenarioName } from '../fixtures'

/**
 * vNEXT PREDICTOR CHAMPIONSHIP — STAGE 12'S REVIEW SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED ==============
 *
 * Not "does it render". Nineteen worlds, each with the reason it exists written
 * into its description, and the questions they settle are:
 *
 *   1. IS THE BRACKET READABLE AT 375? Open `WideDraw` at the narrow frames
 *      first. Sixteen seats across four rounds is the world this layout exists
 *      for, and a knockout TREE would be four unreadable columns there.
 *   2. DOES WIDENING PRODUCE COLUMNS RATHER THAN A SMALLER TREE? Same world at
 *      1440 and 1920: rounds become columns by gaining space, never by
 *      shrinking.
 *   3. WHEN THE READER HAS LOST AND NOBODY SAID SO, WHAT DOES THE PAGE CLAIM?
 *      (`LostButNotStated` — and the answer must be: nothing.)
 *   4. does a half-filled seat read as a hole, or as a person called "Player"?
 *      (`HalfFilledSeat`)
 *   5. does a walkover carry a result without carrying a scoreline or a reason?
 *      (`Walkover`, `EveryDecision`)
 *   6. can the reader find themselves in a draw of sixteen? (`WideDraw`, and
 *      the "Your tie" and "(you)" marks)
 *   7. do two forty-character names survive 375 without clipping? (`LongNames`)
 *   8. does the Penalty Number state its LANE RULE before a refusal rather than
 *      after one? (`PenaltyOpenOdd` beside `PenaltySubmittedZero`)
 *   9. is a round with no kick-off time called unscheduled rather than closed?
 *      (`PenaltyUnscheduled` — a player there has missed nothing)
 *  10. can you find anywhere on any of these pages that the OPPONENT has
 *      submitted, or what they submitted? (You cannot. There is no field.)
 *
 * ============================ THERE ARE NO CONNECTOR LINES ===============
 *
 * Deliberately, at every width. Contract 193 gives a slot per seat and no edge
 * between them, so a line would be this lane inventing the progression. If a
 * reviewer misses them, that is the conversation to have — not a defect to fix
 * by drawing one.
 *
 * ============================ NOTHING HERE READS A CLOCK =================
 *
 * Every world carries a fixed `generatedAt` and pre-settled outcomes.
 */
const meta = {
  title: 'vNext/Predictor Championship',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    motion: { control: 'inline-radio', options: ['system', 'full', 'reduced'] },
    viewports: {
      control: 'check',
      options: ['phone-375', 'phone-430', 'tablet-768', 'laptop-1024', 'laptop-1440', 'desktop-1920'],
    },
    scale: { control: { type: 'range', min: 0.2, max: 1, step: 0.02 } },
  },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

type Story = StoryObj

const ALL_WIDTHS = [
  'phone-375',
  'phone-430',
  'tablet-768',
  'laptop-1024',
  'laptop-1440',
  'desktop-1920',
] as const

/**
 * The page inside a world. The harness renders no second shell.
 *
 * Submitting records the intent on the wrapper so a browser test can observe
 * the EMISSION rather than re-reading the control it pressed — the shape Stage
 * 9 settled. Nothing is written: these worlds have no server behind them.
 */
function ChampionshipHarness({ scenario }: { readonly scenario: ChampionshipScenarioName }) {
  const [lastIntent, setLastIntent] = useState('')
  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-championship-host="" data-vnext-last-intent={lastIntent}>
        <VNextChampionship
          model={championshipScenarios[scenario]}
          onRetry={() => {}}
          onIntent={(intent) => setLastIntent(`penalty:${intent.value}`)}
        />
      </div>
    </VNextShellProvider>
  )
}

function board(
  scenario: ChampionshipScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <ChampionshipHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: championshipScenarioPremises[scenario] } } },
  }
}

/** One world at one width — the addressable frames the browser suite reads. */
function frame(scenario: ChampionshipScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <ChampionshipHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. THE BRACKET
 * ========================================================================== */

/** The ordinary visit. Drawn, a tie to play, and a final still to be filled. */
export const DrawnBracket: Story = board('drawnBracket', ALL_WIDTHS, 0.42)

/**
 * SIXTEEN SEATS ACROSS FOUR ROUNDS.
 *
 * THE WORLD THIS LAYOUT EXISTS FOR. Read it at 375 first: rounds are sections
 * stacked in the server's order, and a player reads DOWN the competition. Then
 * at 1920, where the same sections become columns. A knockout tree would have
 * been four unreadable columns at the first width and would have got there by
 * shrinking rather than by using the space.
 */
export const WideDraw: Story = board('wideDraw', ALL_WIDTHS, 0.42)

/** A play-off, whose round size and slot the server left null. */
export const PlayoffRound: Story = board('playoffRound', ALL_WIDTHS, 0.42)

/** A round the server labelled with nothing. Named by sequence, not counted. */
export const UnlabelledRound: Story = board('unlabelledRound', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * B. WHAT THE PAGE REFUSES TO SAY
 * ========================================================================== */

/**
 * THE BINDING WORLD FOR THE WHOLE STAGE.
 *
 * The reader LOST their only tie and has no later one. Every instinct says
 * print "you are out" — and no season Championship read supplies elimination,
 * so the page says NOTHING. A derivation would be wrong whenever a competition
 * has not finished eliminating, and it would sit exactly where a real verdict
 * goes, which is what makes it the guess a reader would believe.
 */
export const LostButNotStated: Story = board('lostButNotStated', ALL_WIDTHS, 0.42)

/**
 * A WALKOVER, AND AN ORGANISER-AWARDED WALKOVER.
 *
 * Two words, because the server keeps them apart. Neither says WHY: whether the
 * opponent withdrew or was disqualified is `game_memberships.status`, which is
 * not in this read. And neither grows a scoreline.
 */
export const Walkover: Story = board('walkover', ALL_WIDTHS, 0.42)

/** All four settlement vocabularies at once, and not a number among them. */
export const EveryDecision: Story = board('everyDecision', ALL_WIDTHS, 0.42)

/**
 * ONE SIDE OF A SEAT IS EMPTY.
 *
 * It reads "To be decided". Contract 193 literally returns the display name
 * `'Player'` for an unfilled seat, so a surface trusting the name would show a
 * person standing in every hole — and it is not called a bye either, because
 * the read does not say why the seat is empty.
 */
export const HalfFilledSeat: Story = board('halfFilledSeat', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * C. THE ENDINGS
 * ========================================================================== */

/** The reader won it. The only world where the champion is them. */
export const YouAreChampion: Story = board('youAreChampion', ALL_WIDTHS, 0.42)

/** Somebody else won it — and the reader is still not told they are out. */
export const SomeoneElseWon: Story = board('someoneElseWon', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * D. THE STATES THAT ARE NOT A BRACKET
 * ========================================================================== */

/** Entered, and the draw has not been made. Not a failure. */
export const NotDrawn: Story = board('notDrawn', ALL_WIDTHS, 0.42)

/** Not entered. An ordinary answer, and there is no join button. */
export const NotEntered: Story = board('notEntered', ALL_WIDTHS, 0.42)

/** The read did not answer. The only state with a retry. */
export const Unavailable: Story = board('unavailable', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * D2. THE PENALTY NUMBER — the one secret, and the one thing to do
 * ========================================================================== */

/**
 * THE ODD LANE, NOTHING SUBMITTED.
 *
 * The lane rule sits BESIDE the box, not behind a refusal. The server rejects
 * the wrong parity with `check_violation`, and that is knowable in advance —
 * so the control declines to send it. Type an even number and watch the button
 * stay disabled.
 */
export const PenaltyOpenOdd: Story = board('penaltyOpenOdd', ALL_WIDTHS, 0.42)

/**
 * THE EVEN LANE, ALREADY SUBMITTED, AND THE VALUE IS ZERO.
 *
 * `0` is a legal Penalty Number. A page choosing its case on truthiness rather
 * than on `value !== null` shows this player an empty box and tells them they
 * have not submitted — which is why this world exists rather than a tidier one.
 */
export const PenaltySubmittedZero: Story = board('penaltySubmittedZero', ALL_WIDTHS, 0.42)

/** Locked, with a value. The reader sees their own — and nobody else's. */
export const PenaltyLocked: Story = board('penaltyLocked', ALL_WIDTHS, 0.42)

/** Locked, and they never submitted. Said plainly rather than left blank. */
export const PenaltyLockedUnsubmitted: Story = board('penaltyLockedUnsubmitted', ALL_WIDTHS, 0.42)

/**
 * NEITHER LOCKED NOR OPEN.
 *
 * Contract 193 returns both booleans false when the round has no scheduled
 * kick-off, so this proves the surface reads them independently rather than as
 * complements. It must NOT say closed: this player has missed nothing.
 */
export const PenaltyUnscheduled: Story = board('penaltyUnscheduled', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * E. THE WORST STRINGS
 * ========================================================================== */

/**
 * BARTHOLOMEW FOTHERINGAY-PEMBERTON AGAINST KONSTANTINA PAPADOPOULOU-ANDREADIS.
 *
 * Nothing may clip. A player scanning a draw for their own name must be able to
 * read it, and at 375 these are the names that break a layout built for "Ada".
 */
export const LongNames: Story = board('longNames', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * F. MOTION
 * ========================================================================== */

/** Reduced motion, which is a setting and not a degraded page. */
export const ReducedMotion: Story = board('wideDraw', ['laptop-1440'], 0.7, 'reduced')

/* ========================================================================== *
 * G. ADDRESSABLE FRAMES — one world at one width, for the browser suite
 * ========================================================================== */

export const FrameDrawnPhone: Story = frame('drawnBracket', 'phone-375')
export const FrameDrawnLarge: Story = frame('drawnBracket', 'phone-430')
export const FrameDrawnTablet: Story = frame('drawnBracket', 'tablet-768')
export const FrameDrawnLaptop: Story = frame('drawnBracket', 'laptop-1024')
export const FrameDrawnWide: Story = frame('drawnBracket', 'laptop-1440')
export const FrameDrawnDesktop: Story = frame('drawnBracket', 'desktop-1920')

export const FrameWidePhone: Story = frame('wideDraw', 'phone-375')
export const FrameWideTablet: Story = frame('wideDraw', 'tablet-768')
export const FrameWideDesktop: Story = frame('wideDraw', 'desktop-1920')

export const FrameLostPhone: Story = frame('lostButNotStated', 'phone-375')
export const FrameWalkoverPhone: Story = frame('walkover', 'phone-375')
export const FrameEveryDecisionPhone: Story = frame('everyDecision', 'phone-375')
export const FrameHalfFilledPhone: Story = frame('halfFilledSeat', 'phone-375')
export const FrameChampionPhone: Story = frame('youAreChampion', 'phone-375')
export const FrameSomeoneElseWonPhone: Story = frame('someoneElseWon', 'phone-375')
export const FramePlayoffPhone: Story = frame('playoffRound', 'phone-375')
export const FrameUnlabelledPhone: Story = frame('unlabelledRound', 'phone-375')
export const FrameLongNamesPhone: Story = frame('longNames', 'phone-375')
export const FrameLongNamesTablet: Story = frame('longNames', 'tablet-768')
export const FrameNotDrawnPhone: Story = frame('notDrawn', 'phone-375')
export const FrameNotEnteredPhone: Story = frame('notEntered', 'phone-375')
export const FrameUnavailablePhone: Story = frame('unavailable', 'phone-375')

export const FramePenaltyOpenPhone: Story = frame('penaltyOpenOdd', 'phone-375')
export const FramePenaltyOpenTablet: Story = frame('penaltyOpenOdd', 'tablet-768')
export const FramePenaltyZeroPhone: Story = frame('penaltySubmittedZero', 'phone-375')
export const FramePenaltyLockedPhone: Story = frame('penaltyLocked', 'phone-375')
export const FramePenaltyUnsubmittedPhone: Story = frame('penaltyLockedUnsubmitted', 'phone-375')
export const FramePenaltyUnscheduledPhone: Story = frame('penaltyUnscheduled', 'phone-375')
