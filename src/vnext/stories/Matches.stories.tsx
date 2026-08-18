import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextMatches } from '../matches/VNextMatches'
import { VNextMatchCentre } from '../matches/VNextMatchCentre'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import {
  matchCentreScenarioPremises,
  matchCentreScenarios,
  matchesScenarioPremises,
  matchesScenarios,
  shellScenarios,
} from '../fixtures'
import type { MatchCentreScenarioName, MatchesScenarioName } from '../fixtures'
import type { MatchesModel, MatchesScope } from '../models/matches'

/**
 * vNEXT MATCHES AND MATCH CENTRE — STAGE 8'S REVIEW SURFACE.
 *
 * ============================ WHAT A REVIEWER IS BEING ASKED ==============
 *
 * Not "does it render". Twelve list worlds and twelve Match Centre worlds, each
 * with the reason it exists written into its description, and the questions
 * they are here to settle are:
 *
 *   1. does the ONE-COMPETITION player get a competition's matches, or a
 *      platform's fixture database with a filter on it? (`SingleCompetition`)
 *   2. does a LIVE MATCH WITH NO MINUTE read as football happening now, or as a
 *      page that failed? (`SeveralLive`, and worlds 14 and 15 side by side)
 *   3. is a PROVISIONAL score visibly a different claim from a settled one?
 *   4. does the desktop composition USE its width, or is it a stretched phone?
 *   5. does a Match Centre with only core data still look like a premium
 *      football product? (`MatchCentreCoreOnly`)
 *   6. does the COMBINED mode name the competition on every fixture, without
 *      erasing the architecture it is a layer over?
 *
 * ============================ THE MATRIX IS NOT COMPLETE, ON PURPOSE ======
 *
 * Twenty-four worlds times six widths is a hundred and forty-four stories
 * nobody reads and everybody maintains. What is exported is the set the brief
 * asks to be reviewed, plus one addressable frame per world-and-width that
 * `e2e/vnext-matches.spec.ts` measures. A combination worth looking at once is
 * worth an argument on a `Responsive` story, not a permanent export.
 *
 * ============================ EVERY FRAME IS AN HONEST REVIEW =============
 *
 * The pages respond to their CONTAINER rather than the viewport, so a 375px
 * frame composes as a phone even in a 1920px browser. The `scale` on the wider
 * stories is a CSS transform: it shrinks the picture and not the layout.
 *
 * ============================ NOTHING HERE READS A CLOCK ==================
 *
 * Every world carries the instant it describes. A story rendered at midnight
 * and a story rendered at noon are the same picture, which is what makes a
 * screenshot comparable with yesterday's.
 */
const meta = {
  title: 'vNext/Matches',
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
 * `VNextMatches` starts with `VNextShell` itself. Wrapping it in another shell
 * would give the frame two `<main>` landmarks, two navigations and two
 * mastheads — and it looks almost plausible in a screenshot, which is how Stage
 * 7.6 shipped exactly that mistake into two stories before a browser test found
 * it. The world reaches the page's own shell through the PROVIDER, which is how
 * the connected integration does it too.
 *
 * The shell world is chosen to MATCH the page's world rather than being fixed:
 * a one-competition Matches page inside a four-competition shell would be a
 * screenshot in which the chrome and the page disagree about the platform.
 */
function MatchesHarness({
  scenario,
  shellWorld = 'oneCompetition',
}: {
  readonly scenario: MatchesScenarioName
  readonly shellWorld?: keyof typeof shellScenarios
}) {
  const base = matchesScenarios[scenario]
  // The scope control is a real control in the board: pressing it swaps the
  // world, which is how a reviewer can see that the combined mode is reachable
  // and that it names its competitions.
  const [scope, setScope] = useState<MatchesScope>(base.scope.active)

  const model: MatchesModel =
    scope === base.scope.active
      ? base
      : scope === 'combined'
        ? matchesScenarios.combinedTonight
        : matchesScenarios.upcomingMatchweek

  return (
    <VNextShellProvider model={shellScenarios[shellWorld]}>
      <VNextMatches
        model={model}
        onIntent={(intent) => {
          if (intent.kind === 'scope') setScope(intent.scope)
        }}
      />
    </VNextShellProvider>
  )
}

function MatchCentreHarness({
  scenario,
  shellWorld = 'oneCompetition',
}: {
  readonly scenario: MatchCentreScenarioName
  readonly shellWorld?: keyof typeof shellScenarios
}) {
  return (
    <VNextShellProvider model={shellScenarios[shellWorld]}>
      <VNextMatchCentre model={matchCentreScenarios[scenario]} />
    </VNextShellProvider>
  )
}

function board(
  scenario: MatchesScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <MatchesHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: { docs: { description: { story: matchesScenarioPremises[scenario] } } },
  }
}

function centreBoard(
  scenario: MatchCentreScenarioName,
  widths: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale} motion={motion}>
        <MatchCentreHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: {
      docs: { description: { story: matchCentreScenarioPremises[scenario] } },
    },
  }
}

/** One world at one width — the addressable frames the browser suite reads. */
function frame(scenario: MatchesScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <MatchesHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

function centreFrame(scenario: MatchCentreScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <MatchCentreHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * A–F. COMPETITION MATCHES — the twelve worlds
 * ========================================================================== */

/** The ordinary Saturday. The state the design has to be best at. */
export const UpcomingMatchweek: Story = board('upcomingMatchweek', ALL_WIDTHS, 0.42)

/**
 * THREE MATCHES LIVE, AND ONE OF THEM HAS NO MINUTE.
 *
 * The most important world in the group. Look at the third row: the platform
 * can prove that match is in play and cannot prove what minute it is, and that
 * row must read as live football rather than as a row that failed to load. It
 * is not an edge case — it is what EVERY connected live match currently looks
 * like.
 */
export const SeveralLive: Story = board('severalLive', ALL_WIDTHS, 0.42)

/** Finished, live and upcoming in one column, with a rescheduled fixture. */
export const MixedMatchday: Story = board('mixedMatchday', ALL_WIDTHS, 0.42)

export const AllFinished: Story = board('allFinished', ['phone-375', 'laptop-1440'])

/** An empty window. Not an error, and it must not look like one. */
export const NoMatches: Story = board('noMatches', ['phone-375', 'laptop-1440'])

/** A postponed fixture beside a normal one, and one with no kickoff at all. */
export const Postponed: Story = board('postponedDay', ['phone-375', 'laptop-1440'])

/** The worst realistic strings. Nothing may clip at any width. */
export const LongNames: Story = board('longNames', ALL_WIDTHS, 0.42)

/**
 * EVERY OPTIONAL FIELD ABSENT — and this is the shape the CONNECTED page
 * actually produces. No prediction badges, no window label, one fixture with no
 * kickoff. It has to look like a premium football product, not a stripped one.
 */
export const SparseMetadata: Story = board('sparseMetadata', ['phone-375', 'laptop-1440'])

/** A competition that is not a weekly league. The server's own stage words. */
export const GroupStage: Story = board('groupStageMatchday', ['phone-375', 'laptop-1440'])

/** Penalties, extra time and an aggregate — the design for the day they exist. */
export const KnockoutRound: Story = board('knockoutRound', ['phone-375', 'laptop-1440'])

/**
 * THE BINDING PRODUCT TEST — put this beside `CombinedAcrossCompetitions`.
 *
 * One competition: no scope control, no other competition's name, nothing
 * anywhere on the page that suggests a platform exists. The Premier League
 * player gets Premier League matches.
 */
export const SingleCompetition: Story = board('singleCompetition', ['phone-375', 'laptop-1440'])

/**
 * THE SECONDARY MODE. Every fixture names its competition — that is the
 * condition this mode exists under — and the list is the PLAYER's three, not
 * the platform's twenty.
 */
export const CombinedAcrossCompetitions: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['phone-375', 'laptop-1440']}>
      <MatchesHarness scenario="combinedTonight" shellWorld="fourCompetitions" />
    </WorkshopCanvas>
  ),
  parameters: {
    docs: { description: { story: matchesScenarioPremises.combinedTonight } },
  },
}

/** The reduced-motion path. Nothing is lost; only the travel goes. */
export const ReducedMotion: Story = board('severalLive', ['phone-375', 'laptop-1440'], 1, 'reduced')

/* ========================================================================== *
 * G–L. MATCH CENTRE — the twelve worlds
 * ========================================================================== */

export const MatchCentreScheduled: Story = centreBoard('scheduled', ALL_WIDTHS, 0.42)

/**
 * PUT THESE TWO SIDE BY SIDE. Same match, same moment; one provider supplies a
 * minute and one does not. The difference should be one small label and not a
 * page that looks broken.
 */
export const MatchCentreLiveWithMinute: Story = centreBoard('liveWithMinute', ALL_WIDTHS, 0.42)

export const MatchCentreLiveWithoutMinute: Story = centreBoard(
  'liveWithoutMinute',
  ALL_WIDTHS,
  0.42,
)

export const MatchCentreHalfTime: Story = centreBoard('halfTime', ['phone-375', 'laptop-1440'])

export const MatchCentreFullTime: Story = centreBoard('fullTime', ALL_WIDTHS, 0.42)

/**
 * THE PROVIDER SAYS OVER AND THE PLATFORM HAS NOT SETTLED IT. The score is
 * still provisional and the page says so — collapsing this into full time would
 * be a browser promoting a feed to a result.
 */
export const MatchCentreAwaitingResult: Story = centreBoard('awaitingResult', [
  'phone-375',
  'laptop-1440',
])

/** No pulse, no minute, no score, no live affordance anywhere. */
export const MatchCentrePostponed: Story = centreBoard('postponed', ['phone-375', 'laptop-1440'])

export const MatchCentreExtraTime: Story = centreBoard('extraTime', ['phone-375', 'laptop-1440'])

export const MatchCentrePenalties: Story = centreBoard('penalties', ['phone-375', 'laptop-1440'])

/** The ceiling of an honest Match Centre today. */
export const MatchCentreRichContext: Story = centreBoard('richContext', ALL_WIDTHS, 0.42)

/**
 * THE FLOOR, AND THE HARDEST ONE TO GET RIGHT. Two clubs, a kickoff and a
 * stage. Every optional module ABSENT rather than empty — no headings over
 * nothing, no zeroed statistics, no "coming soon".
 */
export const MatchCentreCoreOnly: Story = centreBoard('coreOnly', ALL_WIDTHS, 0.42)

/** A feed that has gone quiet. Said plainly; no minute invented to fill it. */
export const MatchCentreStaleProvider: Story = centreBoard('staleProvider', [
  'phone-375',
  'laptop-1440',
])

export const MatchCentreReducedMotion: Story = centreBoard(
  'liveWithoutMinute',
  ['phone-375', 'laptop-1440'],
  1,
  'reduced',
)

/* ========================================================================== *
 * The measured frames — one world, one width, for the browser suite
 * ========================================================================== */

export const Upcoming375: Story = frame('upcomingMatchweek', 'phone-375')
export const Upcoming430: Story = frame('upcomingMatchweek', 'phone-430')
export const Upcoming768: Story = frame('upcomingMatchweek', 'tablet-768')
export const Upcoming1024: Story = frame('upcomingMatchweek', 'laptop-1024')
export const Upcoming1440: Story = frame('upcomingMatchweek', 'laptop-1440')
export const Upcoming1920: Story = frame('upcomingMatchweek', 'desktop-1920')

export const Live375: Story = frame('severalLive', 'phone-375')
export const Live430: Story = frame('severalLive', 'phone-430')
export const Live1440: Story = frame('severalLive', 'laptop-1440')
export const Live1920: Story = frame('severalLive', 'desktop-1920')

export const Mixed375: Story = frame('mixedMatchday', 'phone-375')
export const Mixed1440: Story = frame('mixedMatchday', 'laptop-1440')

export const Finished375: Story = frame('allFinished', 'phone-375')
export const Finished1440: Story = frame('allFinished', 'laptop-1440')

export const Empty375: Story = frame('noMatches', 'phone-375')
export const Empty1440: Story = frame('noMatches', 'laptop-1440')

export const Postponed375: Story = frame('postponedDay', 'phone-375')
export const Postponed1440: Story = frame('postponedDay', 'laptop-1440')

export const Long375: Story = frame('longNames', 'phone-375')
export const Long430: Story = frame('longNames', 'phone-430')
export const Long1440: Story = frame('longNames', 'laptop-1440')
export const Long1920: Story = frame('longNames', 'desktop-1920')

export const Sparse375: Story = frame('sparseMetadata', 'phone-375')
export const Sparse1440: Story = frame('sparseMetadata', 'laptop-1440')

export const Group375: Story = frame('groupStageMatchday', 'phone-375')
export const Group1440: Story = frame('groupStageMatchday', 'laptop-1440')

export const Knockout375: Story = frame('knockoutRound', 'phone-375')
export const Knockout1440: Story = frame('knockoutRound', 'laptop-1440')

export const One375: Story = frame('singleCompetition', 'phone-375')
export const One1440: Story = frame('singleCompetition', 'laptop-1440')

export const Combined375: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['phone-375']}>
      <MatchesHarness scenario="combinedTonight" shellWorld="fourCompetitions" />
    </WorkshopCanvas>
  ),
}

export const Combined1440: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['laptop-1440']}>
      <MatchesHarness scenario="combinedTonight" shellWorld="fourCompetitions" />
    </WorkshopCanvas>
  ),
}

export const Centre375: Story = centreFrame('richContext', 'phone-375')
export const Centre430: Story = centreFrame('richContext', 'phone-430')
export const Centre768: Story = centreFrame('richContext', 'tablet-768')
export const Centre1024: Story = centreFrame('richContext', 'laptop-1024')
export const Centre1440: Story = centreFrame('richContext', 'laptop-1440')
export const Centre1920: Story = centreFrame('richContext', 'desktop-1920')

export const CentreScheduled375: Story = centreFrame('scheduled', 'phone-375')
export const CentreScheduled1440: Story = centreFrame('scheduled', 'laptop-1440')

export const CentreLiveMinute375: Story = centreFrame('liveWithMinute', 'phone-375')
export const CentreLiveMinute1440: Story = centreFrame('liveWithMinute', 'laptop-1440')

export const CentreLiveNoMinute375: Story = centreFrame('liveWithoutMinute', 'phone-375')
export const CentreLiveNoMinute1440: Story = centreFrame('liveWithoutMinute', 'laptop-1440')

export const CentreHalfTime1440: Story = centreFrame('halfTime', 'laptop-1440')

export const CentreFullTime375: Story = centreFrame('fullTime', 'phone-375')
export const CentreFullTime1440: Story = centreFrame('fullTime', 'laptop-1440')

export const CentreAwaiting1440: Story = centreFrame('awaitingResult', 'laptop-1440')

export const CentrePostponed375: Story = centreFrame('postponed', 'phone-375')
export const CentrePostponed1440: Story = centreFrame('postponed', 'laptop-1440')

export const CentreExtraTime1440: Story = centreFrame('extraTime', 'laptop-1440')
export const CentrePenalties375: Story = centreFrame('penalties', 'phone-375')
export const CentrePenalties1440: Story = centreFrame('penalties', 'laptop-1440')

export const CentreCore375: Story = centreFrame('coreOnly', 'phone-375')
export const CentreCore430: Story = centreFrame('coreOnly', 'phone-430')
export const CentreCore1440: Story = centreFrame('coreOnly', 'laptop-1440')
export const CentreCore1920: Story = centreFrame('coreOnly', 'desktop-1920')

export const CentreStale1440: Story = centreFrame('staleProvider', 'laptop-1440')
