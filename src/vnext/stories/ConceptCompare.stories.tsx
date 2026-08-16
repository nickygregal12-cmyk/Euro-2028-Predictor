import type { StoryObj } from '@storybook/react-vite'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { ArenaHome } from '../concepts/arena/ArenaHome'
import { CommandHome } from '../concepts/command/CommandHome'
import { CinematicHome } from '../concepts/cinematic/CinematicHome'
import { workshopHomeModel } from '../fixtures'
import styles from './ConceptCompare.stories.module.css'

/**
 * A, B AND C AGAINST ONE FIXTURE.
 *
 * The point of the whole stage is the comparison, and a comparison made by
 * clicking between three stories a minute apart is a comparison made from
 * memory. These stories put the three concepts on one board at one width so
 * the difference in INFORMATION ARCHITECTURE — not in styling — is the thing
 * being looked at.
 *
 * Every frame is a real container-framed review: a 430px frame here composes as
 * a phone regardless of how wide the browser showing the board is, and the
 * `scale` is a CSS transform, which shrinks the picture and not the layout.
 *
 * NO CONCEPT IS RECOMMENDED HERE. The owner chooses.
 */
const CONCEPTS = [
  { id: 'a', label: 'A — Matchday Arena', element: <ArenaHome model={workshopHomeModel} /> },
  {
    id: 'b',
    label: 'B — Game Command Centre',
    element: <CommandHome model={workshopHomeModel} />,
  },
  {
    id: 'c',
    label: 'C — Cinematic Football',
    element: <CinematicHome model={workshopHomeModel} />,
  },
] as const

export default {
  title: 'vNext/Home Concepts/Compare A · B · C',
  parameters: { layout: 'fullscreen' },
}

function Board({
  viewport,
  scale,
  caption,
}: {
  viewport: string
  scale: number
  caption: string
}) {
  return (
    <div className={styles.board} data-vnext-workshop="">
      <p className={styles.caption}>{caption}</p>
      <div className={styles.row}>
        {CONCEPTS.map((concept) => (
          <div key={concept.id} className={styles.column}>
            <p className={styles.columnLabel}>{concept.label}</p>
            <WorkshopCanvas viewports={[viewport]} scale={scale}>
              {concept.element}
            </WorkshopCanvas>
          </div>
        ))}
      </div>
    </div>
  )
}

/** The critical mobile comparison. */
export const AllThreeMobile: StoryObj = {
  render: () => (
    <Board
      viewport="phone-430"
      scale={0.86}
      caption="430px — what each concept puts in the first screen"
    />
  ),
}

/** The critical desktop comparison. */
export const AllThreeDesktop: StoryObj = {
  render: () => (
    <Board
      viewport="laptop-1440"
      scale={0.42}
      caption="1440px — what each concept does with the space"
    />
  ),
}

/** The smallest screen, where a composition either survives or does not. */
export const AllThreeSmallPhone: StoryObj = {
  render: () => (
    <Board viewport="phone-375" scale={0.86} caption="375px — the survival width" />
  ),
}

/** The intermediate width that is easy to forget. */
export const AllThreeTablet: StoryObj = {
  render: () => (
    <Board viewport="tablet-768" scale={0.6} caption="768px — the in-between" />
  ),
}

/** The largest review width. */
export const AllThreeWide: StoryObj = {
  render: () => (
    <Board
      viewport="desktop-1920"
      scale={0.32}
      caption="1920px — what the extra width is spent on"
    />
  ),
}
