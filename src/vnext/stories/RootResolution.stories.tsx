import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { VNextShell } from '../app/VNextShell'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { CompetitionMark } from '../app/CompetitionMark'
import { VNextHome } from '../home/VNextHome'
import { VNextDiscovery } from '../discovery/VNextDiscovery'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import { shellActiveContext } from '../models/shell'
import type { ShellScenarioName } from '../fixtures'
import {
  discoveryScenarios,
  homeScenarios,
  shellScenarios,
} from '../fixtures'
import typography from '../foundations/typography.module.css'
import styles from './RootResolution.stories.module.css'

/**
 * vNEXT — WHAT `/` OPENS ON, AND FOR WHOM.
 *
 * ======================== THE ONE QUESTION LEFT OPEN ======================
 *
 * The information architecture is DECIDED and BUILT. Stage 7.5 compared three
 * concepts, Stage 7.6 selected Concept A — the Competition Deck — and
 * `docs/product/vnext-shell-ia.md` §1 states the mental model this lab must not
 * relitigate:
 *
 *   > I am inside a football competition. Everything beneath the shell belongs
 *   > to that competition until I deliberately change it.
 *
 * Two of the three concepts are already settled as SECONDARY and neither may be
 * the front door: cross-competition attention is "a SECONDARY LAYER over a
 * competition-rooted product. Never the front door", and Jump is "an OPTIONAL
 * POWER-USER ACCELERATOR. Never required, never primary".
 *
 * What was never decided is narrower, and both authorities deferred it to the
 * cutover in the same words. The route matrix's `/` row:
 *
 *   > `/` and `/competitions/:c/:s` are ONE visible destination in the target
 *   > IA. The address is untouched — `/` may keep resolving to whatever the
 *   > player's active competition is, AND DECIDING HOW IS THE CUTOVER STAGE'S
 *   > WORK.
 *
 * And §9 of the IA record: "No production route was repointed, replaced,
 * redirected or deleted."
 *
 * So this lab asks ONE question and no others:
 *
 *   WHEN A PLAYER WITH MORE THAN ONE COMPETITION OPENS `/`, WHAT DO THEY SEE?
 *
 * ======================== WHAT IS ALREADY RULED OUT =======================
 *
 * Recency is NOT available and this lab must not draw it. §7 of the IA record
 * omitted "recently viewed competitions" deliberately, on evidence: Stage 7.5's
 * audit "found no per-competition recency authority anywhere in the platform",
 * and `VNextShellModel` therefore "has no recency field at all" — which is
 * stronger than omitting a group, because a shell that wanted to draw fictional
 * recent history would have to add the type first. A candidate that resolves `/`
 * by recency is a candidate that needs a new authority, and it is drawn nowhere
 * below.
 *
 * A favourite is not available either, and for a different reason: in
 * `src/features/hub/playerCompetitions.ts` a favourite is a favourite CLUB
 * within a competition — "presentation prominence only", per competition — not
 * a favourite competition. It cannot answer this question without being
 * redefined.
 *
 * ======================== HOW TO READ THESE STORIES =======================
 *
 * Every candidate renders the SAME player — `fourCompetitions` — through the
 * SAME real components. Nothing here is a mockup: A and the two edges are
 * `VNextHome` and `VNextDiscovery` exactly as production renders them, inside
 * the real `VNextShell`. Only candidate B contains anything drawn for this lab,
 * and it is deliberately plain for the reason the Stage 7.5 lab gave: a
 * placeholder interesting enough to look at is a placeholder somebody treats as
 * a brief.
 *
 * Judge them on arrival cost. The question is not which screen is prettier —
 * two of them are the same screen — it is how many presses stand between
 * opening the app and doing the thing the player came to do, and what the
 * product claims to be in the first second.
 *
 * NO DATABASE, NO CLOCK, NO NETWORK beneath any of this. Every world is a
 * committed fixture, so a story, a test and a screenshot see the same thing.
 */

const meta = {
  title: 'vNext/Root resolution (what `/` opens on)',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
  argTypes: {
    motion: { control: 'inline-radio', options: ['system', 'full', 'reduced'] },
    viewports: {
      control: 'check',
      options: ['phone-375', 'phone-430', 'tablet-768', 'laptop-1440'],
    },
    scale: { control: { type: 'range', min: 0.2, max: 1, step: 0.02 } },
  },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

type Story = StoryObj

/**
 * The world every candidate is judged in, and one host for all of them.
 *
 * `onIntent` is deliberately inert. This lab compares ARRIVAL, and a switcher
 * that worked here would invite a reviewer to judge switching instead — which
 * §6 of the IA record already settled and `vNext/Shell` already demonstrates
 * interactively.
 */
function Root({
  scenario,
  children,
}: {
  scenario: ShellScenarioName
  children: (competition: string) => ReactNode
}) {
  const model = shellScenarios[scenario]
  const context = shellActiveContext(model)
  const competition = context
    ? `${context.competition.name}${
        context.competition.seasonLabel ? ` · ${context.competition.seasonLabel}` : ''
      }`
    : 'No competition'

  return (
    <VNextShellProvider model={model} onIntent={() => {}}>
      {children(competition)}
    </VNextShellProvider>
  )
}

/**
 * CANDIDATE A — `/` IS THE COMPETITION'S HOME.
 *
 * The architecture's own answer, applied literally: the player arrives inside a
 * competition and the shell says which one. Nothing is chosen on the way in,
 * and the competition is changed the way §6 says it is changed — through the
 * switcher, which keeps the destination and changes only the football.
 *
 * The open sub-question this does NOT answer is WHICH competition, and that is
 * the point of drawing it: whatever rule picks one, this is what arrival looks
 * like, so the rule can be argued about separately from the shape.
 */
export const ADeckStraightIn: Story = {
  name: 'A · Straight into a competition',
  args: { viewports: ['phone-375', 'laptop-1440'], theme: 'dark' },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Root scenario="fourCompetitions">
        {() => <VNextHome model={homeScenarios.live} />}
      </Root>
    </WorkshopCanvas>
  ),
}

/**
 * CANDIDATE B — `/` ASKS FIRST.
 *
 * The player names a competition and Home is one press further in. Drawn
 * plainly and on purpose; what is under review is the COST, not the styling.
 *
 * Read it against §6's one-competition contract, which this candidate has to
 * answer too: a chooser offering a single choice "teaches a player there is a
 * decision to make and then spends their press proving there is not". So this
 * candidate is really two rules — ask when there are several, skip when there
 * is one — and a front door that is sometimes there and sometimes not is a
 * harder thing to learn than one that is always the same.
 */
export const BChooseFirst: Story = {
  name: 'B · Choose a competition first',
  args: { viewports: ['phone-375', 'laptop-1440'], theme: 'dark' },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Root scenario="fourCompetitions">
        {() => (
          <VNextShell
            destination="home"
            header={
              <VNextPageHeader
                title="Your competitions"
                competition="Choose where to go"
              />
            }
          >
            <ul className={styles.chooser}>
              {shellScenarios.fourCompetitions.contexts.map((context) => (
                <li key={context.competition.id}>
                  <button type="button" className={styles.choice}>
                    <CompetitionMark competition={context.competition} size="md" />
                    <span className={styles.choiceText}>
                      <span className={typography.emphasis}>
                        {context.competition.name}
                      </span>
                      <span className={typography.micro}>
                        {context.tempoLabel ?? context.competition.seasonLabel}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </VNextShell>
        )}
      </Root>
    </WorkshopCanvas>
  ),
}

/**
 * THE FIRST EDGE — A PLAYER WITH ONE COMPETITION.
 *
 * Not a candidate. This is the case §6 already binds, drawn so that a reviewer
 * can check a candidate against it rather than against a memory of it: no
 * switcher control at all, no "Your competitions" group, no other competition's
 * name anywhere in the permanent chrome, and Explore still one press away.
 *
 * Under candidate A this player's arrival is IDENTICAL to the four-competition
 * player's, which is the property worth having: the platform may be large, but
 * the player's product is the size of their own football.
 */
export const EdgeOneCompetition: Story = {
  name: 'Edge · the player with one competition',
  args: { viewports: ['phone-375', 'laptop-1440'], theme: 'dark' },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Root scenario="oneCompetition">
        {() => <VNextHome model={homeScenarios.live} />}
      </Root>
    </WorkshopCanvas>
  ),
}

/**
 * THE SECOND EDGE — A PLAYER IN NO COMPETITION.
 *
 * Also not a candidate, and the one case where "the competition is the root"
 * has no root to stand on. Discovery is the honest answer: there is nothing to
 * resolve `/` to, and a Home for a competition the player is not in would be an
 * empty room with their name on it.
 *
 * Drawn with the REAL `VNextDiscovery` so the arrival can be judged as a first
 * impression rather than as an error state.
 */
export const EdgeNoCompetitions: Story = {
  name: 'Edge · the player in none',
  args: { viewports: ['phone-375', 'laptop-1440'], theme: 'dark' },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Root scenario="noCompetitions">
        {() => <VNextDiscovery model={discoveryScenarios.catalogue} />}
      </Root>
    </WorkshopCanvas>
  ),
}

/**
 * THE SAME COMPARISON IN LIGHT, because the cutover ships both themes and a
 * front door is the surface most likely to be met in daylight.
 */
export const ALightTheme: Story = {
  name: 'A · Straight in, light theme',
  args: { viewports: ['phone-375', 'laptop-1440'], theme: 'light' },
  render: (args) => (
    <WorkshopCanvas {...args}>
      <Root scenario="fourCompetitions">
        {() => <VNextHome model={homeScenarios.live} />}
      </Root>
    </WorkshopCanvas>
  ),
}
