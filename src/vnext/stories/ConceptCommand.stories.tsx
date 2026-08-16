import type { Meta, StoryObj } from '@storybook/react-vite'
import { CommandHome } from '../concepts/command/CommandHome'
import { workshopHomeModel } from '../fixtures'
import { conceptStories } from './conceptStory'

/**
 * CONCEPT B — GAME COMMAND CENTRE.
 *
 * The competition is the event. Every zone answers one of four questions — how
 * am I doing, what changed, what must I decide, who is catching me — and
 * football arrives as consequence: a ledger of points moving rather than a
 * stage. The densest of the three, with team colour at its most restrained so
 * the only large colours left mean a game state.
 *
 * Same model, same matchday, same fixture as Concepts A and C.
 */
const meta = {
  title: 'vNext/Home Concepts/B — Game Command Centre',
  component: CommandHome,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CommandHome>

export default meta

const stories = conceptStories(<CommandHome model={workshopHomeModel} />)

export const Phone375: StoryObj = stories.phone375

/** The critical mobile review width. */
export const Phone430: StoryObj = stories.phone430

export const Tablet768: StoryObj = stories.tablet768

/** The critical desktop comparison width — the three-zone console. */
export const Laptop1440: StoryObj = stories.laptop1440

/** At 1920 the wire is pulled out into a fourth column. */
export const Desktop1920: StoryObj = stories.desktop1920

export const MobileAndDesktop: StoryObj = stories.mobileAndDesktop

export const AllWidths: StoryObj = stories.allWidths

export const ReducedMotion: StoryObj = stories.reducedMotion
