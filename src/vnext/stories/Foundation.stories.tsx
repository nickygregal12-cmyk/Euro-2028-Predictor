import type { Meta, StoryObj } from '@storybook/react-vite'
import { motion } from 'framer-motion'
import { useVNextMotion, vnextMotion } from '../foundations/motion'
import { VNextRoot } from '../foundations/VNextRoot'
import surfaces from '../foundations/surfaces.module.css'
import typography from '../foundations/typography.module.css'
import { vnextStory } from './vnextDecorator'
import styles from './Foundation.stories.module.css'

/**
 * The vNext visual foundation, on one page.
 *
 * These stories are the review surface for the foundation itself: if a surface
 * step is invisible against its neighbour, or a text step is unreadable on a
 * card, it shows up here before it reaches a concept.
 */
const meta = {
  title: 'vNext/Foundation/Overview',
  parameters: { layout: 'fullscreen' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const SURFACES = [
  { name: 'surface', className: surfaces.surface, note: 'Plain panel' },
  { name: 'raised', className: surfaces.raised, note: 'Lifted card' },
  {
    name: 'interactive',
    className: surfaces.interactive,
    note: 'Hover me (pointer only)',
  },
  { name: 'sunken', className: surfaces.sunken, note: 'A well' },
] as const

const STATE_COLOURS = [
  { token: '--vnext-accent', name: 'Accent / action' },
  { token: '--vnext-live', name: 'Live' },
  { token: '--vnext-hit', name: 'Prediction hit' },
  { token: '--vnext-warn', name: 'Deadline' },
  { token: '--vnext-miss', name: 'Missed' },
  { token: '--vnext-joker', name: 'Joker' },
  { token: '--vnext-rank-up', name: 'Rank up' },
  { token: '--vnext-rank-down', name: 'Rank down' },
] as const

export const Surfaces: Story = {
  decorators: [vnextStory()],
  render: () => (
    <>
      <h2 className={typography.label}>Surfaces</h2>
      <div className={styles.grid}>
        {SURFACES.map((surface) => (
          <div key={surface.name} className={`${surface.className} ${styles.swatch}`}>
            <p className={typography.body}>{surface.name}</p>
            <p className={typography.micro}>{surface.note}</p>
          </div>
        ))}
      </div>

      <h2 className={typography.label}>State colours</h2>
      <div className={styles.grid}>
        {STATE_COLOURS.map((entry) => (
          <div key={entry.token} className={`${surfaces.sunken} ${styles.swatch}`}>
            <span
              className={styles.chip}
              style={{ backgroundColor: `var(${entry.token})` }}
            />
            <p className={typography.caption}>{entry.name}</p>
            <p className={typography.micro}>{entry.token}</p>
          </div>
        ))}
      </div>
    </>
  ),
}

export const Typography: Story = {
  decorators: [vnextStory()],
  render: () => (
    <>
      <p className={typography.hero}>127</p>
      <p className={typography.display}>Matchweek 4</p>
      <h2 className={typography.headline}>Glenmore Athletic v Strathkelvin</h2>
      <h3 className={typography.title}>Work League</h3>
      <p className={typography.lead}>
        The lead paragraph size, used where one sentence has to do the work of a
        whole card.
      </p>
      <p className={typography.body}>
        Body text. Inter at 400, the reading weight, on the surfaces vNext
        actually uses.
      </p>
      <p className={typography.label}>Section label</p>
      <p className={typography.caption}>
        Caption text for qualifiers and metadata.
      </p>
      <p className={typography.micro}>Micro text for the smallest annotations.</p>
      <p className={`${typography.body} ${typography.clamp2} ${styles.narrow}`}>
        Sunday Morning Five-a-side Survivors — a deliberately long league name,
        clamped to two lines so a rail cannot be pushed wider by a name.
      </p>
    </>
  ),
}

/**
 * Every motion primitive, side by side, with the reduced-motion path beside the
 * full one. The point is that the reduced column still SHOWS THE STATE — it is
 * quieter, not absent.
 */
export const Motion: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className={styles.motionColumns}>
      <VNextRoot motion="full">
        <div className={styles.motionColumn}>
          <h2 className={typography.label}>Full motion</h2>
          <MotionSamples />
        </div>
      </VNextRoot>
      <VNextRoot motion="reduced">
        <div className={styles.motionColumn}>
          <h2 className={typography.label}>Reduced motion</h2>
          <MotionSamples />
        </div>
      </VNextRoot>
    </div>
  ),
}

function MotionSamples() {
  const rise = useVNextMotion(vnextMotion.riseIn)
  const lift = useVNextMotion(vnextMotion.liftAndPress)
  const pulse = useVNextMotion(vnextMotion.livePulse)
  const rank = useVNextMotion(vnextMotion.rankMove)
  const points = useVNextMotion(vnextMotion.pointsEmphasis)

  return (
    <div className={styles.motionSamples}>
      <motion.div
        className={`${surfaces.surface} ${styles.sample}`}
        variants={rise}
        initial="hidden"
        animate="visible"
      >
        <span className={typography.caption}>riseIn — entrance</span>
      </motion.div>

      <motion.div
        className={`${surfaces.interactive} ${styles.sample}`}
        variants={lift}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
      >
        <span className={typography.caption}>liftAndPress — hover and tap</span>
      </motion.div>

      <div className={`${surfaces.surface} ${styles.sample}`}>
        <motion.span
          className={styles.pulseDot}
          variants={pulse}
          animate="rest"
          aria-hidden="true"
        />
        <span className={typography.caption}>livePulse — live state</span>
      </div>

      <div className={`${surfaces.surface} ${styles.sample}`}>
        <motion.span variants={rank} initial="flat" animate="up" aria-hidden="true">
          ▲
        </motion.span>
        <span className={typography.caption}>rankMove — rank change</span>
      </div>

      <div className={`${surfaces.surface} ${styles.sample}`}>
        <motion.span
          className={typography.numeric}
          variants={points}
          initial="rest"
          animate="changed"
        >
          125
        </motion.span>
        <span className={typography.caption}>pointsEmphasis — points change</span>
      </div>
    </div>
  )
}
