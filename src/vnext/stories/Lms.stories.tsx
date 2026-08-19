import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextLms } from '../lms/VNextLms'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import { lmsScenarioPremises, lmsScenarios, shellScenarios } from '../fixtures'
import type { LmsScenarioName } from '../fixtures'

/**
 * vNEXT LAST MAN STANDING — STAGE 11'S REVIEW SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED ==============
 *
 * Not "does it render". Nineteen worlds, each with the reason it exists written
 * into its description, and the questions they settle are:
 *
 *   1. does this read as a DIFFERENT GAME from Match Predictor, or as the same
 *      page with fewer fields? There is no score input anywhere and one press
 *      spends a club for the season. (`OpenRound` beside the Predictor group)
 *   2. can a used or shut club be pressed — or does it merely LOOK unpressable?
 *      (`ManyUsed`, `LockedRound`, `Eliminated`)
 *   3. when the picked club WON and the player is OUT, which does the page
 *      say? (`WonButEliminated`, and its mirror `LostButAlive`)
 *   4. is the deadline SAID rather than counted, and does an unscheduled window
 *      admit it has none? (`LockedRound`, `Unscheduled`)
 *   5. do "not entered", "not offered", "no round" and "could not load" read as
 *      four different situations?
 *   6. does a fifty-character club name survive at 375 without clipping — on
 *      the one surface where misreading a name costs a season? (`LongClubNames`)
 *
 * ============================ THE PICK IS A REAL CONTROL ==================
 *
 * Pressing a club in the harness marks it chosen and spends it, exactly as a
 * connected host would after the write and the re-read. That is the honest
 * demonstration: the page holds no pick state of its own, because the server
 * owns what has been spent.
 *
 * ============================ NOTHING HERE READS A CLOCK ==================
 *
 * Every world carries its round's STATE, so the lock a story shows is the lock
 * the fixture chose rather than whatever time the machine thinks it is.
 */
const meta = {
  title: 'vNext/Last Man Standing',
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
 * THE PAGE INSIDE A WORLD, AND THE HARNESS RENDERS NO SECOND SHELL.
 *
 * Pressing a club records the intent on the wrapper so a browser test can
 * observe the EMISSION rather than re-reading the element it pressed — the
 * shape Stage 9 settled — and marks the club chosen, which is what a connected
 * host produces after the write and the re-read.
 */
function LmsHarness({ scenario }: { readonly scenario: LmsScenarioName }) {
  const [picked, setPicked] = useState<string | null>(null)
  const [lastIntent, setLastIntent] = useState('')

  const world = lmsScenarios[scenario]
  const model =
    picked === null || world.body.kind !== 'round'
      ? world
      : {
          ...world,
          body: {
            ...world.body,
            round: {
              ...world.body.round,
              choices: world.body.round.choices.map((choice) => ({
                ...choice,
                home:
                  choice.home.action.kind === 'pick' && choice.home.action.teamId === picked
                    ? { ...choice.home, action: { kind: 'chosen' as const } }
                    : choice.home,
                away:
                  choice.away.action.kind === 'pick' && choice.away.action.teamId === picked
                    ? { ...choice.away, action: { kind: 'chosen' as const } }
                    : choice.away,
              })),
            },
          },
        }

  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-lms-host="" data-vnext-last-intent={lastIntent}>
        <VNextLms
          model={model}
          onIntent={(intent) => {
            setPicked(intent.teamId)
            setLastIntent(`pick:${intent.teamId}`)
          }}
          onRetry={() => setLastIntent('retry')}
        />
      </div>
    </VNextShellProvider>
  )
}

function board(
  scenario: LmsScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <LmsHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: lmsScenarioPremises[scenario] } } },
  }
}

/** One world at one width — the addressable frames the browser suite reads. */
function frame(scenario: LmsScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <LmsHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. THE ROUND
 * ========================================================================== */

/** The ordinary visit. One press away from spending a club for the season. */
export const OpenRound: Story = board('openRound', ALL_WIDTHS, 0.42)

/** A pick is held. Marked rather than pressable; everything else stays open. */
export const PickMade: Story = board('pickMade', ALL_WIDTHS, 0.42)

/**
 * ONE PICKABLE CLUB IN THE WHOLE ROUND.
 *
 * The count beneath the list is the warning, and it is a real state rather than
 * an error — read the singular.
 */
export const OneClubLeft: Story = board('oneClubLeft', ALL_WIDTHS, 0.42)

/**
 * EIGHT CLUBS SPENT.
 *
 * The used list is permanent furniture rather than a detail: it is the thing a
 * player forgets between rounds, and the reason they lose.
 */
export const ManyUsed: Story = board('manyUsed', ALL_WIDTHS, 0.42)

/** A round with no fixtures published yet. A sentence, not an empty grid. */
export const EmptyRound: Story = board('emptyRound', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * B. THE TWO VERDICTS — the worlds a derivation gets wrong
 * ========================================================================== */

/**
 * THE PICKED CLUB WON, AND THE PLAYER IS ELIMINATED.
 *
 * The binding world for the whole stage. `pickOutcome` is what the CLUB did;
 * `entryOutcome` is what the competition says the PLAYER now is, and only the
 * settlement job writes it. A page that read the result to produce the verdict
 * would say the opposite of the truth here — and would look completely normal
 * in every other world.
 */
export const WonButEliminated: Story = board('wonButEliminated', ALL_WIDTHS, 0.42)

/**
 * THE CLUB LOST AND THE PLAYER IS STILL IN.
 *
 * The mirror. Some rules give a second life and the browser cannot see them.
 */
export const LostButAlive: Story = board('lostButAlive', ALL_WIDTHS, 0.42)

/**
 * THE PICK HAS NO RESULT AT ALL.
 *
 * A round without one never eliminates, and the page must not read the silence
 * as bad news.
 */
export const PostponedPick: Story = board('postponedPick', ALL_WIDTHS, 0.42)

/** Survived the last round and back for the next one. */
export const SurvivedLastRound: Story = board('survivedLastRound', ALL_WIDTHS, 0.42)

/** Out of the competition, looking at an open round he cannot play. */
export const Eliminated: Story = board('eliminated', ALL_WIDTHS, 0.42)

/** The last one standing. The season is over and there is nothing to pick. */
export const Champion: Story = board('champion', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * C. THE DEADLINE
 * ========================================================================== */

/**
 * PICKS HAVE CLOSED.
 *
 * Every club is text rather than a dead button, and the page says WHEN they
 * closed rather than counting anything. There is no countdown on this surface:
 * the browser does not own this deadline, and a ticking number implies it does.
 */
export const LockedRound: Story = board('lockedRound', ALL_WIDTHS, 0.42)

/** The round has not opened. A different sentence from locked, and not a fault. */
export const NotOpenYet: Story = board('notOpenYet', ALL_WIDTHS, 0.42)

/**
 * A WINDOW WITH NO DEADLINE AT ALL.
 *
 * Not open — there is nothing to beat, and the write would have nothing to
 * validate against. It says so rather than inventing a time.
 */
export const Unscheduled: Story = board('unscheduled', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * D. THE STATES THAT ARE NOT A ROUND
 * ========================================================================== */

/** Entered, between rounds. Not a failure and not the end of the game. */
export const NoRound: Story = board('noRound', ALL_WIDTHS, 0.42)

/**
 * THE PLAYER HAS NOT JOINED.
 *
 * An ordinary answer — the game is opt-in. And there is NO JOIN BUTTON: Stage
 * 11 does not own entry, and a control here would be a door onto a corridor
 * that has not been built.
 */
export const NotEntered: Story = board('notEntered', ALL_WIDTHS, 0.42)

/**
 * THE SEASON DOES NOT RUN THIS GAME AT ALL.
 *
 * About the COMPETITION rather than the player, and it must not read as "come
 * back later" to somebody who was never offered it.
 */
export const NotOffered: Story = board('notOffered', ALL_WIDTHS, 0.42)

/** The round read did not answer. The only state with a retry. */
export const Unavailable: Story = board('unavailable', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * E. THE WORST STRINGS
 * ========================================================================== */

/**
 * INVERNESS CALEDONIAN THISTLE AGAINST HEART OF MIDLOTHIAN.
 *
 * Nothing may clip. A club name is the one thing a player must read exactly
 * before spending it, and on a 375 phone these are the names that break a
 * layout built for "Celtic".
 */
export const LongClubNames: Story = board('longClubNames', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * F. MOTION
 * ========================================================================== */

/**
 * REDUCED MOTION, WHICH IS A SETTING AND NOT A DEGRADED PAGE.
 *
 * Every club, the standing and the deadline are present and legible; only the
 * arrival transition is gone. A pick list has nothing that depends on movement
 * to be understood.
 */
export const ReducedMotion: Story = board('openRound', ['laptop-1440'], 0.7, 'reduced')

/* ========================================================================== *
 * G. ADDRESSABLE FRAMES — one world at one width, for the browser suite
 * ========================================================================== */

export const FrameOpenPhone: Story = frame('openRound', 'phone-375')
export const FrameOpenLarge: Story = frame('openRound', 'phone-430')
export const FrameOpenTablet: Story = frame('openRound', 'tablet-768')
export const FrameOpenLaptop: Story = frame('openRound', 'laptop-1024')
export const FrameOpenWide: Story = frame('openRound', 'laptop-1440')
export const FrameOpenDesktop: Story = frame('openRound', 'desktop-1920')

export const FramePickMadePhone: Story = frame('pickMade', 'phone-375')
export const FrameManyUsedPhone: Story = frame('manyUsed', 'phone-375')
export const FrameOneClubLeftPhone: Story = frame('oneClubLeft', 'phone-375')
export const FrameLockedPhone: Story = frame('lockedRound', 'phone-375')
export const FrameNotOpenPhone: Story = frame('notOpenYet', 'phone-375')
export const FrameUnscheduledPhone: Story = frame('unscheduled', 'phone-375')
export const FrameEliminatedPhone: Story = frame('eliminated', 'phone-375')
export const FrameWonButEliminatedPhone: Story = frame('wonButEliminated', 'phone-375')
export const FrameWonButEliminatedDesktop: Story = frame('wonButEliminated', 'desktop-1920')
export const FrameLostButAlivePhone: Story = frame('lostButAlive', 'phone-375')
export const FrameChampionPhone: Story = frame('champion', 'phone-375')
export const FrameLongClubNamesPhone: Story = frame('longClubNames', 'phone-375')
export const FrameLongClubNamesTablet: Story = frame('longClubNames', 'tablet-768')
export const FrameNotEnteredPhone: Story = frame('notEntered', 'phone-375')
export const FrameNotOfferedPhone: Story = frame('notOffered', 'phone-375')
export const FrameUnavailablePhone: Story = frame('unavailable', 'phone-375')
export const FrameEmptyRoundPhone: Story = frame('emptyRound', 'phone-375')
