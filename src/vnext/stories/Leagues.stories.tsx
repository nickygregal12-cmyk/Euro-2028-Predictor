import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextLeagues } from '../leagues/VNextLeagues'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import { leaguesScenarioPremises, leaguesScenarios, shellScenarios } from '../fixtures'
import type { LeaguesScenarioName } from '../fixtures'

/**
 * vNEXT LEAGUES — STAGE 9'S REVIEW SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED ==============
 *
 * Not "does it render". Twenty-one worlds, each with the reason it exists
 * written into its description, and the questions they are here to settle are:
 *
 *   1. do TWO PEOPLE WITH THE SAME NAME stay two people — one openable, one
 *      not, neither borrowing the other's row? (`DuplicateNames`)
 *   2. does a player who is 318th get an answer to "where do I stand", or a
 *      table they are not in? (`SeasonYouOffPage`, `LargeLeague`)
 *   3. are TIED RANKS printed as the server sent them, or renumbered into a
 *      tidy 1–6 that is wrong? (`TiedRanks`, `LeagueTied`)
 *   4. is a row the caller may NOT open plain text, or a disabled control that
 *      advertises something they cannot have? (`NothingOpenable`)
 *   5. before anything settles, is there NO movement column — rather than a
 *      column of dashes saying "nobody moved"? (`LeagueUnsettled` beside
 *      `LeagueSettled`)
 *   6. is a member who never entered the game MARKED, or silently ranked on
 *      zero beside people who have played? (`LeagueWithNonEntrants`)
 *   7. does the table survive a sixty-character league name and a forty-
 *      character unbroken username without clipping either? (`LongNames`)
 *
 * ============================ THE CHOOSER IS A REAL CONTROL ===============
 *
 * Pressing "Season" or a league in the harness SWAPS THE WORLD, exactly as a
 * connected host would swap the model after re-reading. That is the honest
 * demonstration: the page has no local scope state, because the two tables are
 * two reads with two different rank authorities and a highlight that ran ahead
 * of the model would show one league selected above another league's table.
 *
 * ============================ NOTHING HERE READS A CLOCK ==================
 *
 * Every world carries the instant it describes, so a story rendered at midnight
 * and one rendered at noon are the same picture.
 */
const meta = {
  title: 'vNext/Leagues',
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
 * WHICH WORLD EACH SCOPE PRESS LANDS ON.
 *
 * The harness is the host, and a host answers a scope intent by reading the
 * other table. These are the worlds those reads would return, so the chooser
 * behaves in Storybook the way it will behave connected — and so a browser test
 * can press a league and check that the table it gets is that league's.
 */
const scopeWorlds: Readonly<Record<string, LeaguesScenarioName>> = {
  global: 'seasonTable',
  'league-sunday-club': 'leagueSettled',
  'league-office': 'largeLeague',
  'league-family': 'leagueWithNonEntrants',
  'league-old-school': 'severalLeagues',
}

/**
 * THE PAGE INSIDE A REAL WORLD, AND THE HARNESS RENDERS NO SECOND SHELL.
 *
 * `VNextLeagues` starts with `VNextShell` itself; wrapping it in another would
 * give the frame two `<main>` landmarks and two mastheads. The world reaches
 * the page's own shell through the PROVIDER, which is how the connected
 * integration does it too.
 */
function LeaguesHarness({
  scenario,
  shellWorld = 'oneCompetition',
}: {
  readonly scenario: LeaguesScenarioName
  readonly shellWorld?: keyof typeof shellScenarios
}) {
  const [world, setWorld] = useState<LeaguesScenarioName>(scenario)

  /**
   * WHAT THE PAGE LAST ASKED THE HOST FOR, recorded on the wrapper so a browser
   * test can observe an intent at all.
   *
   * IT IS THE ONLY WAY TO PROVE THE IDENTITY RULE. Pressing a player and then
   * reading the id back off the element the test selected by that id is a
   * tautology; reading what the page EMITTED is the actual assertion, and it is
   * how the duplicate-name world is checked to open the right person.
   */
  const [lastIntent, setLastIntent] = useState<string>('')

  return (
    <VNextShellProvider model={shellScenarios[shellWorld]}>
      <div data-vnext-leagues-host="" data-vnext-last-intent={lastIntent}>
        <VNextLeagues
          model={leaguesScenarios[world]}
          onIntent={(intent) => {
            if (intent.kind === 'scope') {
              const key =
                intent.scope.kind === 'global' ? 'global' : intent.scope.leagueId
              const next = scopeWorlds[key]
              if (next) setWorld(next)
              setLastIntent(`scope:${key}`)
              return
            }
            // BOTH ADDRESSES ARE RECORDED, so a browser test can prove the
            // doorway hands Stage 10 the pair it needs — and, in the
            // duplicate-name world, that the two Sams carry two references.
            setLastIntent(`openPlayer:${intent.playerId}@${intent.playerRef ?? 'no-ref'}`)
          }}
        />
      </div>
    </VNextShellProvider>
  )
}

function board(
  scenario: LeaguesScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <LeaguesHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: leaguesScenarioPremises[scenario] } } },
  }
}

/** One world at one width — the addressable frames the browser suite reads. */
function frame(scenario: LeaguesScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <LeaguesHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A. THE SEASON TABLE
 * ========================================================================== */

/** The ordinary visit. Most rows are strangers; two are league co-members. */
export const SeasonTable: Story = board('seasonTable', ALL_WIDTHS, 0.42)

/**
 * THE READER IS 318TH OF 412, AND THAT IS THE NORMAL CASE.
 *
 * The three rows at the top are not the answer to "where do I stand" for
 * anybody except three people. The pinned row below the table is, and a surface
 * that looked for `isYou` among the rows would have shown this player nothing
 * at all.
 */
export const SeasonYouOffPage: Story = board('seasonYouOffPage', ALL_WIDTHS, 0.42)

/**
 * FOUR PLAYERS SHARE RANK 2, AND THE NEXT ROW IS RANK 6.
 *
 * Read the rank column. `index + 1` would produce 1, 2, 3, 4, 5, 6 — perfectly
 * plausible, entirely wrong, and invisible in every world where the ranks
 * happen to be consecutive. That is why this one exists as a picture.
 */
export const TiedRanks: Story = board('tiedRanks', ALL_WIDTHS, 0.42)

/**
 * THREE ROWS READ "SAM DOCHERTY". THEY ARE THREE PEOPLE.
 *
 * The binding social-identity world, and the one to look at hardest. One is
 * openable, one is not, one is you. If the surface keyed rows or built
 * destinations from the display name, then either both strangers become
 * clickable, or pressing one opens the other, or React reuses one person's row
 * for another on the next render — and all three are visible here.
 */
export const DuplicateNames: Story = board('duplicateNames', ALL_WIDTHS, 0.42)

/**
 * NOBODY IN THIS TABLE CAN BE OPENED, AND NOTHING SAYS SO.
 *
 * A player in no private league shares nothing with anybody. There must be no
 * button, no disabled control, no lock and no hover affordance that leads
 * nowhere — a disabled row teaches a player they are missing out on something,
 * when the truthful reading is that these are simply strangers.
 */
export const NothingOpenable: Story = board('nothingOpenable', ALL_WIDTHS, 0.42)

/**
 * EVERY ROW OPENABLE, EXCEPT THE ONE THE SERVER COULD NOT ADDRESS.
 *
 * Søren's reach said profile and carried no id, so his row is plain text like a
 * stranger's. The server said "you may look" and did not say where; a browser
 * that concluded a permission from the presence of an id would have opened a
 * door it had no handle for.
 */
export const EveryoneOpenable: Story = board('everyoneOpenable', ALL_WIDTHS, 0.42)

/** The first day of the season. Everyone on nothing, from nothing, all tied. */
export const NewSeason: Story = board('newSeason', ALL_WIDTHS, 0.42)

/** Nobody has entered yet. An ordinary early state, not a failure. */
export const EmptySeason: Story = board('emptySeason', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * B. PRIVATE LEAGUES
 * ========================================================================== */

/**
 * NOTHING HAS SETTLED, SO THERE IS NO MOVEMENT COLUMN.
 *
 * Compare this with `LeagueSettled` beside it. A column of em-dashes would say
 * "nobody moved"; the truth is "nothing has been settled yet", and contract 150
 * is explicit that no surface may render movement while `settled` is false.
 */
export const LeagueUnsettled: Story = board('leagueUnsettled', ALL_WIDTHS, 0.42)

/**
 * A SETTLED MATCHWEEK MOVED PEOPLE — UP, DOWN, AND NOT AT ALL.
 *
 * Every movement carries an arrow, a colour AND a word, so the column is
 * readable in greyscale and readable aloud. The matchweek is named, because "up
 * 2" with no answer to "since when" is a number a player assumes is about
 * today.
 */
export const LeagueSettled: Story = board('leagueSettled', ALL_WIDTHS, 0.42)

/**
 * TWO MEMBERS NEVER ENTERED THE GAME, AND ONE OF THEM MADE THE LEAGUE.
 *
 * The read includes them deliberately, because the alternative hides a league
 * from its own organiser. Drawing them on zero points beside players who have
 * actually played, with nothing to say so, would be a lie of omission.
 */
export const LeagueWithNonEntrants: Story = board('leagueWithNonEntrants', ALL_WIDTHS, 0.42)

/** A league of one. Rank 1 of 1 is real, meaningless, and not a triumph. */
export const LeagueOfOne: Story = board('leagueOfOne', ALL_WIDTHS, 0.42)

/** 240 members, twelve shown, the reader 148th and pinned. */
export const LargeLeague: Story = board('largeLeague', ALL_WIDTHS, 0.42)

/**
 * THE WORST REALISTIC STRINGS.
 *
 * A sixty-character league name in the chooser, an unbroken forty-character
 * username in a table cell, and a long accented double-barrelled name. Nothing
 * may clip, nothing may ellipsise, and the page must not scroll sideways at
 * 375.
 */
export const LongNames: Story = board('longNames', ALL_WIDTHS, 0.42)

/** Five chooser options including Season. The control is the subject. */
export const SeveralLeagues: Story = board('severalLeagues', ALL_WIDTHS, 0.42)

/**
 * TIED ON THE SERVER'S RANK, ON THE SAME POINTS, FROM DIFFERENT MATCHWEEKS.
 *
 * ADR 0012's world: two players on 205 points from 12 and 11 matchweeks are not
 * tied in meaning, and the only reason a reader can tell is that this table
 * refuses to print points on their own.
 */
export const LeagueTied: Story = board('leagueTied', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * C. WHAT THE APPLICATION COULD NOT ANSWER
 * ========================================================================== */

/**
 * THE SEASON TABLE DID NOT ANSWER.
 *
 * The strip names what is missing and the page says there is no table. It does
 * NOT say the competition has no players — only the server can say that.
 */
export const SeasonUnavailable: Story = board('seasonUnavailable', ALL_WIDTHS, 0.42)

/** The league list failed and the table did not. A partial page, named. */
export const LeagueListUnavailable: Story = board('leagueListUnavailable', ALL_WIDTHS, 0.42)

/**
 * THE CHOSEN LEAGUE'S TABLE DID NOT ANSWER, BUT THE LIST DID.
 *
 * The chooser stays usable and still shows which league was asked for, so the
 * player is not stranded in a league they cannot navigate out of.
 */
export const LeagueTableUnavailable: Story = board('leagueTableUnavailable', ALL_WIDTHS, 0.42)

/**
 * STANDINGS ANSWERED, THE LIST DID NOT, SO THE LEAGUE HAS NO NAME.
 *
 * "This league" is the honest label. Inventing one from the id would be worse
 * than admitting the list did not answer.
 */
export const LeagueUnnamed: Story = board('leagueUnnamed', ALL_WIDTHS, 0.42)

/** A league whose members have no entries the read returned. */
export const LeagueEmpty: Story = board('leagueEmpty', ALL_WIDTHS, 0.42)

/* ========================================================================== *
 * D. MOTION
 * ========================================================================== */

/**
 * REDUCED MOTION, WHICH IS A SETTING AND NOT A DEGRADED PAGE.
 *
 * Everything in the table is present and everything is legible; only the
 * arrival transition is gone. A standings table has nothing that depends on
 * movement to be understood, which is exactly why it must not lose anything
 * here.
 */
export const ReducedMotion: Story = board('leagueSettled', ['laptop-1440'], 0.7, 'reduced')

/* ========================================================================== *
 * E. ADDRESSABLE FRAMES — one world at one width, for the browser suite
 * ========================================================================== */

export const FrameSeasonPhone: Story = frame('seasonTable', 'phone-375')
export const FrameSeasonLarge: Story = frame('seasonTable', 'phone-430')
export const FrameSeasonTablet: Story = frame('seasonTable', 'tablet-768')
export const FrameSeasonLaptop: Story = frame('seasonTable', 'laptop-1024')
export const FrameSeasonWide: Story = frame('seasonTable', 'laptop-1440')
export const FrameSeasonDesktop: Story = frame('seasonTable', 'desktop-1920')

export const FrameDuplicateNamesPhone: Story = frame('duplicateNames', 'phone-375')
export const FrameDuplicateNamesDesktop: Story = frame('duplicateNames', 'desktop-1920')

export const FrameTiedRanksPhone: Story = frame('tiedRanks', 'phone-375')
export const FrameYouOffPagePhone: Story = frame('seasonYouOffPage', 'phone-375')
export const FrameNothingOpenablePhone: Story = frame('nothingOpenable', 'phone-375')
export const FrameEveryoneOpenablePhone: Story = frame('everyoneOpenable', 'phone-375')

export const FrameLeagueUnsettledPhone: Story = frame('leagueUnsettled', 'phone-375')
export const FrameLeagueSettledPhone: Story = frame('leagueSettled', 'phone-375')
export const FrameLeagueSettledDesktop: Story = frame('leagueSettled', 'desktop-1920')
export const FrameNonEntrantsPhone: Story = frame('leagueWithNonEntrants', 'phone-375')
export const FrameLongNamesPhone: Story = frame('longNames', 'phone-375')
export const FrameLongNamesTablet: Story = frame('longNames', 'tablet-768')
export const FrameSeveralLeaguesPhone: Story = frame('severalLeagues', 'phone-375')
export const FrameLargeLeagueLaptop: Story = frame('largeLeague', 'laptop-1024')
export const FrameLeagueOfOnePhone: Story = frame('leagueOfOne', 'phone-375')
export const FrameEmptySeasonPhone: Story = frame('emptySeason', 'phone-375')
export const FrameSeasonUnavailablePhone: Story = frame('seasonUnavailable', 'phone-375')
export const FrameLeagueTableUnavailablePhone: Story = frame(
  'leagueTableUnavailable',
  'phone-375',
)
