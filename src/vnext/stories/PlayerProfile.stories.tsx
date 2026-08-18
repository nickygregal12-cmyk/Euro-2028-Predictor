import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextPlayerProfile } from '../player/VNextPlayerProfile'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import {
  playerProfileScenarioPremises,
  playerProfileScenarios,
  shellScenarios,
} from '../fixtures'
import type { PlayerProfileScenarioName } from '../fixtures'

/**
 * vNEXT PLAYER PROFILE — STAGE 10'S REVIEW SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED ==============
 *
 * Not "does it render". Twenty-four worlds, each with the reason it exists
 * written into its description, and the questions they are here to settle are:
 *
 *   1. does the chart plot a POSITION or a running points total, and is its
 *      axis the right way up? A rank improves as it falls, so a season of
 *      promotions drawn on a naive scale slides downhill. (`Climbing` beside
 *      `Falling`)
 *   2. does a refused PROFILE still leave the chart and the head-to-head
 *      visible, since contract 192 needs only `compare`? (`ProfileRefused`)
 *   3. does an empty rivalry read as "not yet comparable" rather than as a
 *      0-0-0 draw? (`NewSeason` beside `LevelRivalry`)
 *   4. is the head-to-head record shown with its DENOMINATOR, when the strip
 *      beneath it is truncated to five of thirty? (`TruncatedWindow`)
 *   5. do TWO PEOPLE WITH THE SAME NAME stay two columns? (`DuplicateName`)
 *   6. is an unsettled matchweek a sentence rather than "0 pts"?
 *      (`PendingMatchweek`)
 *   7. is a player with no predictions spared a "0%"? (`NoAccuracy`)
 *   8. does a fifty-character name clip anywhere, or scroll the page sideways
 *      at 375? (`LongName`)
 *
 * ============================ THE THREE PANELS ARE INDEPENDENT ============
 *
 * Which is the thing to look at hardest. The profile needs a shared private
 * league; the chart and the comparison need only contract 191's `compare`. Six
 * worlds below refuse one and answer another, because a page with a single
 * permission flag could not draw them.
 *
 * ============================ NOTHING HERE READS A CLOCK ==================
 *
 * Every world carries the instant it describes, so a story rendered at midnight
 * and one rendered at noon are the same picture.
 */
const meta = {
  title: 'vNext/Player Profile',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    motion: { control: 'inline-radio', options: ['system', 'full', 'reduced'] },
    viewports: {
      control: 'check',
      options: [
        'phone-375',
        'phone-430',
        'tablet-768',
        'laptop-1024',
        'laptop-1440',
        'desktop-1920',
      ],
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
 * THE PAGE INSIDE A REAL WORLD, AND THE HARNESS RENDERS NO SECOND SHELL.
 *
 * `VNextPlayerProfile` starts with `VNextShell` itself; wrapping it in another
 * would give the frame two `<main>` landmarks and two mastheads. The world
 * reaches the page's own shell through the PROVIDER, as the connected
 * integration does.
 *
 * The retry count is recorded on the wrapper so a browser test can prove the
 * control actually asked the host for something — reading the button back off
 * itself would be a tautology.
 */
function ProfileHarness({ scenario }: { readonly scenario: PlayerProfileScenarioName }) {
  const [retries, setRetries] = useState(0)

  return (
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <div data-vnext-profile-host="" data-vnext-retries={retries}>
        <VNextPlayerProfile
          model={playerProfileScenarios[scenario]}
          onRetry={() => setRetries((count) => count + 1)}
        />
      </div>
    </VNextShellProvider>
  )
}

function board(
  scenario: PlayerProfileScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <ProfileHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: playerProfileScenarioPremises[scenario] } } },
  }
}

/** One world at one width — the addressable frames the browser suite reads. */
function frame(scenario: PlayerProfileScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <ProfileHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. THE ORDINARY PAGE
 * ========================================================================== */

/** All three reads answered: a season, a plotted position and a comparison. */
export const OpenProfile: Story = board('openProfile', ALL_WIDTHS, 0.42)

/**
 * YOUR OWN PROFILE, WHERE THERE IS NO ONE TO COMPARE WITH.
 *
 * The RPC refuses a self-comparison in terms, and it is right to: the answer
 * would render one column twice. The panel says so rather than showing an empty
 * table or hiding itself, because a missing panel would read as a permission.
 */
export const YourOwnProfile: Story = board('yourOwnProfile', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * B. THE THREE BOUNDARIES — the worlds a single permission flag cannot draw
 * ========================================================================== */

/**
 * THE PROFILE IS REFUSED AND THE OTHER TWO PANELS ANSWER.
 *
 * The binding world for Stage 10's architecture. Contract 151 needs a shared
 * PRIVATE LEAGUE — sharing a competition is not enough, because a season may
 * have fifty thousand entrants and none of them agreed to be looked up.
 * Contract 192 needs only `compare`, and justifies it: a matchweek, a total and
 * a position are what the season leaderboard already shows every entrant, and
 * no prediction appears in that payload at all.
 *
 * So this reader may plot this player and compare with them, and may not open
 * their season. A page with one `permitted` flag would have hidden two panels
 * the server was willing to answer.
 */
export const ProfileRefused: Story = board('profileRefused', ALL_WIDTHS, 0.42)

/** Profile and comparison refused; positions still visible. */
export const RankOnly: Story = board('rankOnly', ALL_WIDTHS, 0.42)

/**
 * A CO-MEMBER WHO NEVER ENTERED THIS SEASON'S GAME.
 *
 * About the PLAYER, not about permission, and contract 151 returns it
 * deliberately — the alternative hides a league from the person who created it.
 * The sentence must not read as a refusal.
 */
export const NotEntered: Story = board('notEntered', ALL_WIDTHS, 0.42)

/**
 * THE DOORWAY CARRIED NO SEASON ENTRY REFERENCE.
 *
 * Both contract-192 reads are addressed by `playerRef`, so with none there is
 * nothing to ask. That is a gap in what this build was handed — NOT a refusal —
 * and the two panels say "not available from here" rather than implying a
 * permission was withheld.
 */
export const Unaddressable: Story = board('unaddressable', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * C. THE CHART
 * ========================================================================== */

/**
 * 301ST TO 12TH. THE AXIS TEST.
 *
 * A rank is a number that improves as it FALLS. Plotted on a naive linear
 * scale, this season of promotions is drawn as a slide downhill — a mistake
 * that is completely silent unless you look at a season like this one. The line
 * here must rise.
 */
export const Climbing: Story = board('climbing', ALL_WIDTHS, 0.42)

/** 2nd to 88th. The same test in the other direction; this line must fall. */
export const Falling: Story = board('falling', ALL_WIDTHS, 0.42)

/**
 * SEVENTH EVERY WEEK.
 *
 * There is no range to scale across. The line sits on the centre rather than
 * dividing by zero, or pinning to an edge that would read as the best or worst
 * season of the player's life.
 */
export const FlatRank: Story = board('flatRank', ALL_WIDTHS, 0.42)

/** One settled matchweek. A single marker and no line. */
export const SinglePoint: Story = board('singlePoint', ALL_WIDTHS, 0.42)

/**
 * THE FIELD GREW FROM 60 TO 412 OVER THE SEASON.
 *
 * "12th" means something different in each of those, so one field size printed
 * beneath the chart would be wrong for most of the line. The caption says the
 * field changed and names the one the reader is looking at now.
 */
export const FieldChanged: Story = board('fieldChanged', ALL_WIDTHS, 0.42)

/**
 * FOURTH TO SEVENTH IN A FIELD OF 412 — WHY THE AXIS IS ZOOMED.
 *
 * Scaled to [1, 412] this is three pixels of a flat line: the entire truth and
 * no information. Scaled to the range actually occupied it is a readable
 * season, and it is honest only because the axis prints those same two bounds.
 * Check that the numbers beside the plot are the numbers the line was drawn
 * between.
 */
export const BigField: Story = board('bigField', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * D. THE COMPARISON
 * ========================================================================== */

/**
 * THIRTY MATCHWEEKS COMPARED, FIVE IN THE STRIP.
 *
 * The denominator world. `recent` is truncated by the server and the record is
 * stated separately, so a surface tallying the strip would print 3-2 for a
 * 14-13-3 rivalry. Read the headline: the count of matchweeks compared has to
 * be there, and it has to be thirty.
 */
export const TruncatedWindow: Story = board('truncatedWindow', ALL_WIDTHS, 0.42)

/**
 * LEVEL ON POINTS, FOUR DRAWS, OVER TWELVE REAL MATCHWEEKS.
 *
 * Put this beside `NewSeason`. Both have a symmetric record; only one of them
 * is a rivalry. If the two pages read the same, the denominator is not doing
 * its job.
 */
export const LevelRivalry: Story = board('levelRivalry', ALL_WIDTHS, 0.42)

/**
 * BOTH OF YOU ARE CALLED SAM DOCHERTY.
 *
 * The social-identity world. The comparison still has two distinguishable
 * columns, because one of them is always "You" whatever the reader is called,
 * and the rows are keyed by the season reference rather than by the name.
 */
export const DuplicateName: Story = board('duplicateName', ALL_WIDTHS, 0.42)

/** Entered, nothing banked. "Not yet ranked", never a zeroth place. */
export const NoStandingYet: Story = board('noStandingYet', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * E. HONEST ZEROES AND EMPTY SEASONS
 * ========================================================================== */

/**
 * THE FIRST DAY, WHERE EVERY FIGURE IS ZERO AND NONE OF THEM MEAN ZERO.
 *
 * Nothing settled, nothing to plot, nothing compared. "0-0-0, level on points"
 * would be a sentence about two players who have never met; the panel says
 * there is nothing to compare instead. No percentage appears anywhere, because
 * every rate here would be a division by nothing.
 */
export const NewSeason: Story = board('newSeason', ALL_WIDTHS, 0.42)

/**
 * A LOCKED MATCHWEEK NOBODY HAS MARKED YET.
 *
 * Your own profile shows your own unsettled picks — they are yours — and the
 * matchweek reads "Not settled yet". "0 pts" would be a scoreline the player
 * did not get, and it is one `?? 0` away at all times.
 */
export const PendingMatchweek: Story = board('pendingMatchweek', ALL_WIDTHS, 0.42)

/**
 * A STANDING, AND NO PREDICTIONS AT ALL.
 *
 * "0% exact" is an accusation against somebody who has simply not started. The
 * counts appear; the percentages do not.
 */
export const NoAccuracy: Story = board('noAccuracy', ALL_WIDTHS, 0.42)

/**
 * A FIFTY-CHARACTER DISPLAY NAME.
 *
 * In the masthead, in the comparison's column heading and in every sentence
 * that names the player. Nothing may clip, nothing may ellipsise, and the page
 * must not scroll sideways at 375.
 */
export const LongName: Story = board('longName', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * F. WHAT THE APPLICATION COULD NOT ANSWER
 * ========================================================================== */

/** The profile read failed, alone. One apology, one retry, two intact panels. */
export const ProfileUnavailable: Story = board('profileUnavailable', ALL_WIDTHS, 0.42)

/** The rank-history read failed, alone. */
export const RankUnavailable: Story = board('rankUnavailable', ALL_WIDTHS, 0.42)

/** The comparison read failed, alone. */
export const RivalryUnavailable: Story = board('rivalryUnavailable', ALL_WIDTHS, 0.42)

/**
 * ALL THREE READS FAILED, AND THE PAGE IS STILL A PAGE.
 *
 * The heading comes from what the doorway held — a name and two server-issued
 * addresses — so there is never a blank screen, and each panel admits its own
 * gap rather than one error page standing in for three different failures.
 */
export const AllUnavailable: Story = board('allUnavailable', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * G. MOTION
 * ========================================================================== */

/**
 * REDUCED MOTION, WHICH IS A SETTING AND NOT A DEGRADED PAGE.
 *
 * The chart is a static drawing either way — it has no animated reveal to lose
 * — so everything on this page is present and legible; only the arrival
 * transition is gone.
 */
export const ReducedMotion: Story = board('openProfile', ['laptop-1440'], 0.7, 'reduced')

/* ========================================================================== *
 * H. ADDRESSABLE FRAMES — one world at one width, for the browser suite
 * ========================================================================== */

export const FrameOpenPhone: Story = frame('openProfile', 'phone-375')
export const FrameOpenLarge: Story = frame('openProfile', 'phone-430')
export const FrameOpenTablet: Story = frame('openProfile', 'tablet-768')
export const FrameOpenLaptop: Story = frame('openProfile', 'laptop-1024')
export const FrameOpenWide: Story = frame('openProfile', 'laptop-1440')
export const FrameOpenDesktop: Story = frame('openProfile', 'desktop-1920')

export const FrameClimbingPhone: Story = frame('climbing', 'phone-375')
export const FrameClimbingDesktop: Story = frame('climbing', 'desktop-1920')
export const FrameFallingPhone: Story = frame('falling', 'phone-375')
export const FrameFlatRankPhone: Story = frame('flatRank', 'phone-375')
export const FrameSinglePointPhone: Story = frame('singlePoint', 'phone-375')
export const FrameFieldChangedPhone: Story = frame('fieldChanged', 'phone-375')
export const FrameBigFieldPhone: Story = frame('bigField', 'phone-375')

export const FrameProfileRefusedPhone: Story = frame('profileRefused', 'phone-375')
export const FrameUnaddressablePhone: Story = frame('unaddressable', 'phone-375')
export const FrameNotEnteredPhone: Story = frame('notEntered', 'phone-375')
export const FrameYourOwnPhone: Story = frame('yourOwnProfile', 'phone-375')

export const FrameTruncatedWindowPhone: Story = frame('truncatedWindow', 'phone-375')
export const FrameTruncatedWindowDesktop: Story = frame('truncatedWindow', 'desktop-1920')
export const FrameNewSeasonPhone: Story = frame('newSeason', 'phone-375')
export const FrameLevelRivalryPhone: Story = frame('levelRivalry', 'phone-375')
export const FrameDuplicateNamePhone: Story = frame('duplicateName', 'phone-375')
export const FrameNoStandingPhone: Story = frame('noStandingYet', 'phone-375')

export const FramePendingMatchweekPhone: Story = frame('pendingMatchweek', 'phone-375')
export const FrameNoAccuracyPhone: Story = frame('noAccuracy', 'phone-375')
export const FrameLongNamePhone: Story = frame('longName', 'phone-375')
export const FrameLongNameTablet: Story = frame('longName', 'tablet-768')

export const FrameProfileUnavailablePhone: Story = frame('profileUnavailable', 'phone-375')
export const FrameAllUnavailablePhone: Story = frame('allUnavailable', 'phone-375')
