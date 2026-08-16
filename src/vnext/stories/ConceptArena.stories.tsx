import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArenaHome } from '../concepts/arena/ArenaHome'
import { workshopHomeModel } from '../fixtures'
import { conceptStories } from './conceptStory'

/**
 * CONCEPT A — MATCHDAY ARENA.
 *
 * Football is the event. One match takes a whole stage, everything else is a
 * dense row beneath or beside it, and the user's own standing is a line in the
 * masthead rather than a panel. Team colour is at its loudest here.
 *
 * Same model, same matchday, same fixture as Concepts B and C — the only thing
 * that differs between the three is the composition.
 */
const meta = {
  title: 'vNext/Home Concepts/A — Matchday Arena',
  component: ArenaHome,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ArenaHome>

export default meta

const stories = conceptStories(<ArenaHome model={workshopHomeModel} />)

/** The smallest screen the product has to survive. */
export const Phone375: StoryObj = stories.phone375

/** The critical mobile review width. */
export const Phone430: StoryObj = stories.phone430

export const Tablet768: StoryObj = stories.tablet768

/** The critical desktop comparison width. */
export const Laptop1440: StoryObj = stories.laptop1440

export const Desktop1920: StoryObj = stories.desktop1920

/** The two review widths side by side. */
export const MobileAndDesktop: StoryObj = stories.mobileAndDesktop

/** All five at once. Scaled visually only — container queries see real widths. */
export const AllWidths: StoryObj = stories.allWidths

/** The reduced-motion path: same content, no travel. */
export const ReducedMotion: StoryObj = stories.reducedMotion
