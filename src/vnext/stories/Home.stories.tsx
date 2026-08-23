import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextHome } from '../home/VNextHome'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import { homeScenarios } from '../fixtures'
import type { HomeScenarioName } from '../fixtures'
import board from './Home.stories.module.css'

/**
 * vNEXT HOME — THE GOLD STANDARD REVIEW SURFACE.
 *
 * Stage 3's job was comparison, so its Storybook group was three concepts side
 * by side. That group is gone: there is one Home now, and what this group has
 * to answer instead is whether that one Home holds up across the states it will
 * actually be in and the widths it will actually be seen at.
 *
 * THE MATRIX IS DELIBERATELY NOT COMPLETE. Four scenarios times five widths is
 * twenty stories nobody reads and everybody maintains. What is here is the set
 * the brief asks to be reviewed — live at every width, decision and competition
 * at the two that decide a design, the new-season edge case, reduced motion —
 * plus one `Responsive` story with controls for everything else. A combination
 * worth looking at once is worth an argument on the Responsive story, not a
 * permanent export.
 *
 * EVERY FRAME IS AN HONEST REVIEW. The frames come from `WorkshopCanvas`, and
 * because Home responds to its CONTAINER rather than the viewport, a 430px
 * frame composes as a phone even when the browser showing it is 1920 wide. The
 * `scale` on the wider stories is a CSS transform: it shrinks the picture and
 * not the layout, so a 1920 frame at 62% still answers container queries as
 * 1920.
 */
const meta = {
  title: 'vNext/Home',
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
        'laptop-1440',
        'desktop-1920',
      ],
    },
    scale: { control: { type: 'range', min: 0.2, max: 1, step: 0.02 } },
  },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

function home(
  scenario: HomeScenarioName,
  viewports: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): StoryObj {
  return {
    parameters: { layout: 'fullscreen' },
    render: () => (
      <WorkshopCanvas viewports={viewports} scale={scale} motion={motion}>
        <VNextHome model={homeScenarios[scenario]} />
      </WorkshopCanvas>
    ),
  }
}

/* ---- LIVE MATCHDAY — the football is the event -------------------------- */

/** The smallest screen the product has to survive. */
export const LiveMatchday375: StoryObj = home('live', ['phone-375'])

/** The primary mobile design review width. */
export const LiveMatchday430: StoryObj = home('live', ['phone-430'])

/** The in-between width that is easy to forget. */
export const LiveMatchday768: StoryObj = home('live', ['tablet-768'], 0.9)

/** The primary desktop design review width. */
export const LiveMatchday1440: StoryObj = home('live', ['laptop-1440'], 0.8)

/** Where the competitive module earns its own column. */
export const LiveMatchday1920: StoryObj = home('live', ['desktop-1920'], 0.62)

/* ---- DECISION — your next decision is the event ------------------------- */

export const Decision430: StoryObj = home('decision', ['phone-430'])

export const Decision1440: StoryObj = home('decision', ['laptop-1440'], 0.8)

/** The widest band, where the competitive module takes its own column. */
export const Decision1920: StoryObj = home('decision', ['desktop-1920'], 0.62)

/* ---- COMPETITION — your competition is the event ------------------------ */

export const Competition430: StoryObj = home('competition', ['phone-430'])

export const Competition1440: StoryObj = home('competition', ['laptop-1440'], 0.8)

/**
 * The widest band on a quiet day.
 *
 * This emphasis has no separate social zone — the league race IS its dominant
 * zone — so it composes in two columns where live and decision take three. The
 * first build inherited the three-track rule anyway and left a 340px column
 * nothing was ever placed into; this story is the review surface that would have
 * shown it, and `e2e/vnext-home.spec.ts` now measures it at every wide width.
 */
export const Competition1920: StoryObj = home('competition', ['desktop-1920'], 0.62)

/* ---- EDGE STATES -------------------------------------------------------- */

/**
 * A user four predictions old, in no private league, looking at fixtures that
 * carry no venue, no head to head and no consensus. Every empty path on the
 * page at once — and the reason the competitive zone has a written empty state
 * rather than a blank panel.
 */
export const NewSeason430: StoryObj = home('newSeason', ['phone-430'])

export const NewSeason1440: StoryObj = home('newSeason', ['laptop-1440'], 0.8)

/** The emptiest state at the widest width — where dead space shows up first. */
export const NewSeason1920: StoryObj = home('newSeason', ['desktop-1920'], 0.62)

/**
 * EVERY FIGURE THE REAL APPLICATION CANNOT STATE, ALL AT ONCE.
 *
 * Added in Stage 6, when Home met real reads and five figures turned out to be
 * genuinely unavailable rather than merely mocked: the season rank and its field
 * size, rank movement, points banked today and points on the pitch. The four
 * scenarios above were left exactly as they were — they are the accepted visual
 * authority and a later stage does not get to edit an approved screenshot — so
 * the reduced state is its own scenario instead.
 *
 * WHAT TO LOOK FOR. Not "does it render". The question is whether an unranked
 * masthead still reads as the same page: the standing block keeps its shape and
 * loses its claims, the rank tile says a word instead of an ordinal, the ladder
 * rows keep their column alignment with no movement arrow in them, and no
 * qualifier under a number asserts a quiet afternoon nobody reported.
 */
export const Reduced430: StoryObj = home('reduced', ['phone-430'])

export const Reduced1440: StoryObj = home('reduced', ['laptop-1440'], 0.8)

export const Reduced1920: StoryObj = home('reduced', ['desktop-1920'], 0.62)

/**
 * A PLAYER WHO HAS BEEN AWAY SINCE THE WEEKEND.
 *
 * The only board where "Since you were last here" is drawn at all, which is
 * why it exists: the zone renders nothing on a first visit and nothing when
 * nothing has finished since the marker, so every other scenario is correctly
 * silent about it and none of them shows a reviewer what it looks like.
 *
 * WHAT TO LOOK FOR. That it reads as a catch-up rather than as a second
 * fixture list: quieter rows, no form runs, no league positions, and the
 * "and 2 more" that stops the sample reading as the whole weekend. And that it
 * sits ABOVE the deadline banner — a player who has not been told the results
 * should not be asked for a prediction first.
 */
export const Returning430: StoryObj = home('returning', ['phone-430'])

export const Returning1440: StoryObj = home('returning', ['laptop-1440'], 0.8)

export const Returning1920: StoryObj = home('returning', ['desktop-1920'], 0.62)

/* ---- CROSS-CUTTING REVIEWS ---------------------------------------------- */

/** The two review widths side by side, which is how hierarchy is judged. */
export const MobileAndDesktop: StoryObj = home(
  'live',
  ['phone-430', 'laptop-1440'],
  0.7,
)

/** All five widths at once. Scaled visually only — container queries see real widths. */
export const AllWidths: StoryObj = home(
  'live',
  ['phone-375', 'phone-430', 'tablet-768', 'laptop-1440', 'desktop-1920'],
  0.36,
)

/**
 * The three emphases on one board, at the width that decides a mobile design.
 *
 * Same masthead, same score bar, same navigation, same type, same surfaces —
 * and a different dominant zone. This is the story that proves Home is one
 * surface with three emphases rather than three pages sharing a palette.
 */
export const ThreeEmphases: StoryObj = {
  parameters: { layout: 'fullscreen' },
  render: () => <EmphasisBoard viewport="phone-430" scale={0.86} />,
}

/** The same three, at the width that decides a desktop design. */
export const ThreeEmphasesDesktop: StoryObj = {
  parameters: { layout: 'fullscreen' },
  render: () => <EmphasisBoard viewport="laptop-1440" scale={0.42} />,
}

const EMPHASES: readonly { scenario: HomeScenarioName; label: string }[] = [
  { scenario: 'live', label: 'Live — the football is the event' },
  { scenario: 'decision', label: 'Decision — your next call is the event' },
  { scenario: 'competition', label: 'Competition — the table is the event' },
]

function EmphasisBoard({ viewport, scale }: { viewport: string; scale: number }) {
  return (
    <div className={board.board} data-vnext-workshop="">
      <p className={board.caption}>
        One Home, three emphases — same masthead, same score bar, same
        navigation, same type
      </p>
      <div className={board.row}>
        {EMPHASES.map((entry) => (
          <div key={entry.scenario} className={board.column}>
            <p className={board.columnLabel}>{entry.label}</p>
            <WorkshopCanvas viewports={[viewport]} scale={scale}>
              <VNextHome model={homeScenarios[entry.scenario]} />
            </WorkshopCanvas>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The reduced-motion path: same content, no travel. */
export const ReducedMotion: StoryObj = home(
  'live',
  ['phone-430', 'laptop-1440'],
  0.7,
  'reduced',
)

/**
 * Everything else, with controls.
 *
 * Scenario is fixed to the live matchday here because the arg controls belong
 * to `WorkshopCanvas`; switch width, scale and motion freely, and use the named
 * stories above for the other three scenarios.
 */
export const Responsive: StoryObj<typeof meta> = {
  args: {
    viewports: ['phone-430', 'laptop-1440'],
    scale: 0.7,
    motion: 'system',
    children: <VNextHome model={homeScenarios.live} />,
  },
}
