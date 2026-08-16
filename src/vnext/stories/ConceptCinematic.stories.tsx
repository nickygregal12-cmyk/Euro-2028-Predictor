import type { Meta, StoryObj } from '@storybook/react-vite'
import { CinematicHome } from '../concepts/cinematic/CinematicHome'
import { workshopHomeModel } from '../fixtures'
import { conceptStories } from './conceptStory'

/**
 * CONCEPT C — CINEMATIC FOOTBALL.
 *
 * Discovery and storytelling. One hero — the closest deadline the user has not
 * answered — takes most of the first screen, with the live matches beside it
 * from tablet width up, and everything else is browsed through horizontal
 * rails of posters. Rivals get the same poster treatment as fixtures, which is
 * this concept's strongest claim. Team colour is atmosphere here.
 *
 * Same model, same matchday, same fixture as Concepts A and B.
 */
const meta = {
  title: 'vNext/Home Concepts/C — Cinematic Football',
  component: CinematicHome,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof CinematicHome>

export default meta

const stories = conceptStories(<CinematicHome model={workshopHomeModel} />)

export const Phone375: StoryObj = stories.phone375

/** The critical mobile review width. */
export const Phone430: StoryObj = stories.phone430

export const Tablet768: StoryObj = stories.tablet768

/** The critical desktop comparison width. */
export const Laptop1440: StoryObj = stories.laptop1440

export const Desktop1920: StoryObj = stories.desktop1920

export const MobileAndDesktop: StoryObj = stories.mobileAndDesktop

export const AllWidths: StoryObj = stories.allWidths

/** Reduced motion: the rails stop travelling, the posters stop lifting. */
export const ReducedMotion: StoryObj = stories.reducedMotion
