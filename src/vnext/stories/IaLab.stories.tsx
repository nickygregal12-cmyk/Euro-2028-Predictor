import type { Meta, StoryObj } from '@storybook/react-vite'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import { IA_CONCEPTS, IA_CONCEPT_KEYS, IaConcept } from '../ia/IaLab'
import type { IaConceptKey } from '../ia/IaLab'
import { iaScenarios } from '../fixtures'
import type { IaScenarioName } from '../fixtures'
import styles from './IaLab.stories.module.css'

/**
 * vNEXT STAGE 7.5 — THE INFORMATION-ARCHITECTURE LAB.
 *
 * THIS IS A SELECTION SURFACE, NOT A DESIGN. Three architectures render the
 * same twelve deterministic worlds, and the stories exist so a human can
 * compare them and CHOOSE one. Nothing here proposes a winner, nothing is
 * ordered by merit, and the keys are `a`, `b`, `c` in alphabetical order for
 * exactly that reason.
 *
 * WHAT IS UNDER REVIEW IS THE CHROME AND NOTHING ELSE. Every destination body
 * is shared code — the same league table, the same game status lines, the same
 * discovery catalogue — so a reviewer comparing two stories is comparing what
 * is permanently on screen, what a switch costs, and how many presses a journey
 * takes. That is the only fair way to review an information architecture.
 *
 * EVERY STORY IS INTERACTIVE. A navigation concept cannot be judged from a
 * still: press the switcher, filter by competition, open the command surface,
 * click a rival in a private league and find the way back. The comparison
 * stories put two or three concepts side by side at one width, and the matrix
 * stories put one concept across the widths that compose differently.
 *
 * NO DATABASE ANYWHERE BENEATH THIS FILE, and no clock. `iaScenarios` is pure
 * data; a story, a test and a screenshot see the same world.
 */

const meta = {
  title: 'vNext/IA Lab (Stage 7.5)',
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

/**
 * Deliberately the untyped `StoryObj`, as `vNext/Match Predictor` already uses.
 * The canvas takes `children`, so a story that supplies its content through
 * `render` cannot satisfy an args type that requires them — and threading a
 * placeholder child into every story's args to please the checker would put a
 * lie in the args panel.
 */
type Story = StoryObj

/** One concept in one world, with its name and mental model stated above it. */
function Framed({
  concept,
  scenario,
}: {
  concept: IaConceptKey
  scenario: IaScenarioName
}) {
  const model = iaScenarios[scenario]
  return (
    <div className={styles.framed}>
      <p className={styles.caption}>
        <span className={styles.conceptTag}>Concept {concept.toUpperCase()}</span>
        <span className={styles.conceptName}>{IA_CONCEPTS[concept].name}</span>
        <span className={styles.premise}>{model.premise}</span>
      </p>
      <IaConcept concept={concept} model={model} />
    </div>
  )
}

/**
 * All three concepts, one world, one width.
 *
 * THIS IS THE STORY THE SELECTION IS MADE FROM. Everything else exists to
 * answer a question this one raises.
 */
function Compare({
  scenario,
  concepts = IA_CONCEPT_KEYS,
}: {
  scenario: IaScenarioName
  concepts?: readonly IaConceptKey[]
}) {
  return (
    <div className={styles.compare}>
      {concepts.map((concept) => (
        <Framed key={concept} concept={concept} scenario={scenario} />
      ))}
    </div>
  )
}

/* ==========================================================================
   the three concepts, side by side
   ========================================================================== */

/** Four competitions, one live, one 41 minutes from locking, one quiet. */
export const CompareOnAPhone: Story = {
  args: { viewports: ['phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="regular" />
    </WorkshopCanvas>
  ),
}

export const CompareOnADesktop: Story = {
  args: { viewports: ['laptop-1440'], scale: 0.62 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="regular" />
    </WorkshopCanvas>
  ),
}

/* ==========================================================================
   scale — the binding requirement
   ========================================================================== */

/**
 * ONE COMPETITION. The question every concept has to pass: does the product
 * feel like a Premier League prediction game, or like a platform the player is
 * visiting?
 *
 * AND THE SECOND HALF OF THAT QUESTION, which the first review of this lab
 * found unanswered: the product may FEEL like a one-competition product, but
 * the other nineteen have to stay findable. Both phone widths, because the
 * concept that costs a one-competition player nothing is also the concept with
 * the least room to put the way out.
 */
export const OneCompetition: Story = {
  args: { viewports: ['phone-375', 'phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="single" />
    </WorkshopCanvas>
  ),
}

/** Eleven competitions, two of them followed rather than played. */
export const ElevenCompetitions: Story = {
  args: { viewports: ['phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="power" />
    </WorkshopCanvas>
  ),
}

/** Twenty published, relevant to three, and none of them the first three. */
export const TwentyPublished: Story = {
  args: { viewports: ['phone-430', 'laptop-1440'], scale: 0.7 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="catalogue" />
    </WorkshopCanvas>
  ),
}

/* ==========================================================================
   football states
   ========================================================================== */

export const Matchday: Story = {
  args: { viewports: ['phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="matchday" />
    </WorkshopCanvas>
  ),
}

/** Nine minutes, three scorelines missing, and an unmade LMS pick. */
export const Deadline: Story = {
  args: { viewports: ['phone-375'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="deadline" />
    </WorkshopCanvas>
  ),
}

/** Nothing live and nothing due — where Concept B has the most to prove. */
export const QuietDay: Story = {
  args: { viewports: ['phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="quiet" />
    </WorkshopCanvas>
  ),
}

/* ==========================================================================
   games
   ========================================================================== */

/**
 * LAST MAN STANDING AS THE WHOLE STORY. Everything else is finished; one club,
 * twenty-six minutes, elimination if it locks empty. If a concept buries this,
 * it is visible here.
 */
export const LastManStanding: Story = {
  args: { viewports: ['phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="lms" />
    </WorkshopCanvas>
  ),
}

/** A competition that runs only the Match Predictor, beside one whose Championship registration has closed. */
export const UnsupportedGame: Story = {
  args: { viewports: ['phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="unsupported" />
    </WorkshopCanvas>
  ),
}

/* ==========================================================================
   edges
   ========================================================================== */

/** A new account: nothing followed, nothing joined, no context to be in. */
export const NoCompetitionSelected: Story = {
  args: { viewports: ['phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="newcomer" />
    </WorkshopCanvas>
  ),
}

/** Deliberate discovery, from a competition the player neither plays nor follows. */
export const Discovery: Story = {
  args: { viewports: ['phone-430'], scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="discovery" />
    </WorkshopCanvas>
  ),
}

/**
 * THE LONGEST STRINGS THE FIXTURES HOLD, in every control at once: "Union of
 * European Football Associations Champions League", "National Women's Soccer
 * League Championship" and "Marguerite Ostrowska-Fitzwilliam". Nothing may be
 * truncated and nothing may overflow.
 */
export const LongNames: Story = {
  args: { viewports: ['phone-375', 'laptop-1440'], scale: 0.7 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="longNames" />
    </WorkshopCanvas>
  ),
}

/* ==========================================================================
   one concept across every width
   ========================================================================== */

const ALL_WIDTHS = [
  'phone-375',
  'phone-430',
  'tablet-768',
  'laptop-1024',
  'laptop-1440',
  'desktop-1920',
] as const

export const ConceptAAcrossWidths: Story = {
  args: { viewports: [...ALL_WIDTHS], scale: 0.36 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Framed concept="a" scenario="regular" />
    </WorkshopCanvas>
  ),
}

export const ConceptBAcrossWidths: Story = {
  args: { viewports: [...ALL_WIDTHS], scale: 0.36 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Framed concept="b" scenario="regular" />
    </WorkshopCanvas>
  ),
}

export const ConceptCAcrossWidths: Story = {
  args: { viewports: [...ALL_WIDTHS], scale: 0.36 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Framed concept="c" scenario="regular" />
    </WorkshopCanvas>
  ),
}

/* ==========================================================================
   reduced motion
   ========================================================================== */

/**
 * REDUCED MOTION IS A COHERENT STILL SURFACE, not a 1ms animation. Nothing in
 * these concepts is carried by movement alone: the active destination is a
 * colour and `aria-current`, urgency is a colour and a word, and the sheet, the
 * menu and the command surface simply appear.
 */
export const ReducedMotion: Story = {
  args: { viewports: ['phone-430'], motion: 'reduced', scale: 1 },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Compare scenario="regular" />
    </WorkshopCanvas>
  ),
}

/* ==========================================================================
   the open control
   ========================================================================== */

type PlaygroundArgs = {
  motion: VNextMotionSetting
  viewports: string[]
  scale: number
  concept: IaConceptKey
  scenario: IaScenarioName
}

/** Any concept, any world, any width. Everything the fixed stories omit. */
export const Playground: StoryObj<PlaygroundArgs> = {
  args: {
    motion: 'system',
    viewports: ['phone-430', 'laptop-1440'],
    scale: 0.7,
    concept: 'a',
    scenario: 'regular',
  },
  argTypes: {
    concept: { control: 'inline-radio', options: [...IA_CONCEPT_KEYS] },
    scenario: {
      control: 'select',
      options: Object.keys(iaScenarios),
    },
  },
  render: ({ concept, scenario, ...canvas }) => (
    <WorkshopCanvas {...canvas}>
      <Framed concept={concept} scenario={scenario} />
    </WorkshopCanvas>
  ),
}
