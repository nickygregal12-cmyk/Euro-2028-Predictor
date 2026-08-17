import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextShell } from '../app/VNextShell'
import { VNextShellProvider } from '../app/VNextShellProvider'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { VNextHome } from '../home/VNextHome'
import { VNextMatchPredictor } from '../predictor/VNextMatchPredictor'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import {
  SHELL_GAME_NAMES,
  shellActiveContext,
  shellContextById,
} from '../models/shell'
import type {
  ShellDestinationId,
  ShellGame,
  ShellIntent,
  VNextShellModel,
} from '../models/shell'
import { homeScenarios, openPredictorModel, rehearsePredictor } from '../fixtures'
import type { PredictorActions, PredictorModel } from '../models/predictor'
import { shellScenarioPremises, shellScenarios } from '../fixtures'
import type { ShellScenarioName } from '../fixtures'
import typography from '../foundations/typography.module.css'
import demo from './Shell.stories.module.css'

/**
 * vNEXT SHELL — THE SELECTED INFORMATION ARCHITECTURE.
 *
 * ======================== WHAT CHANGED IN STAGE 7.6 =======================
 *
 * This group used to answer one question — "does the shell host a page that is
 * not Home?" — with three deliberately dull placeholders. It now answers a
 * bigger one, because the shell itself changed: Stage 7.5's information-
 * architecture lab was reviewed and **Concept A, the Competition Deck, was
 * selected as the primary vNext IA**, with cross-competition attention retained
 * from Concept B as a SECONDARY layer and Jump retained from Concept C as an
 * OPTIONAL accelerator. Stage 7.6 migrated that into `app/VNextShell`.
 *
 * `vNext/IA Lab (Stage 7.5)` is still there and should stay there. It is the
 * evidence for why this architecture exists, including the two that lost.
 *
 * ======================== WHAT THESE STORIES ARE FOR =======================
 *
 * The one question that matters, asked ten ways:
 *
 *   THE PLATFORM MAY BE LARGE. THE PLAYER'S PRODUCT MUST FEEL SMALL.
 *
 * A player with only the Premier League must get a Premier League prediction
 * game — not a twenty-competition dashboard with the Premier League currently
 * selected. Compare `One competition` against `Platform scale` at 1440 and the
 * permanent chrome should be nearly the same size; the difference should be
 * three rows in a rail, not a different product.
 *
 * ======================== THEY ARE INTERACTIVE ============================
 *
 * A navigation architecture cannot be judged from a still. Press the switcher,
 * change competition and watch the destination survive it; open the attention
 * layer and go to a game in another competition; press Jump — or `Ctrl+K` on a
 * desktop frame — and check that competitions, games and leagues stay in three
 * separate groups.
 *
 * ======================== THE DESTINATION BODIES ARE STUBS =================
 *
 * `Matches`, `Games` and `Leagues` render a plain panel that names what would
 * be there. **They are not designs and not proposals.** Stage 8 builds Matches,
 * and a placeholder interesting enough to look at is a placeholder somebody
 * treats as a brief. The two REAL pages — the Gold Standard Home and the Stage
 * 7 Match Predictor — are rendered as themselves, unmodified, in
 * `Home inside a competition` and `Predictor inside a competition`.
 *
 * NO DATABASE AND NO CLOCK beneath this file. Every scenario is pure data, so a
 * story, a test and a screenshot see the same world.
 */

const meta = {
  title: 'vNext/Shell',
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
 * Deliberately the untyped `StoryObj`, as `vNext/Match Predictor` and the IA lab
 * already use: the canvas takes `children`, so a story that supplies its
 * content through `render` cannot satisfy an args type that requires them.
 */
type Story = StoryObj

const ALL_WIDTHS = [
  'phone-375',
  'phone-430',
  'tablet-768',
  'laptop-1024',
  'laptop-1440',
  'desktop-1920',
] as const

/* ========================================================================== *
 * The destination stubs
 * ========================================================================== */

const DESTINATION_TITLES: Readonly<Record<ShellDestinationId, string>> = {
  home: 'Home',
  matches: 'Matches',
  games: 'Games',
  leagues: 'Leagues',
}

/**
 * WHAT A DESTINATION WOULD HOLD, in one sentence and no design.
 *
 * The `Games` stub is the exception worth looking at, because it is the one
 * thing the selected architecture claims that a stub can actually demonstrate:
 * the three games are PEERS with their own status vocabularies, and a game the
 * competition does not run is ABSENT rather than greyed. Open
 * `Unsupported game` and Last Man Standing is simply not in the list.
 */
function DestinationStub({
  model,
  destination,
}: {
  model: VNextShellModel
  destination: ShellDestinationId
}) {
  const context = shellActiveContext(model)

  if (destination === 'games') {
    return (
      <div className={demo.column}>
        <div className={demo.panel}>
          <p className={typography.label}>Stage 9+ · not built</p>
          <p className={demo.status}>
            {context === null
              ? 'No competition in context, so there are no games to list.'
              : `Every game ${context.competition.name} runs, as peers. Stage 7.6 builds no page here; the list below exists to prove the hierarchy, not to propose one.`}
          </p>
        </div>
        {context === null ? null : (
          <ul className={demo.gameList}>
            {context.games.map((game) => (
              <li key={game.key} className={demo.gameRow}>
                <span className={typography.emphasis}>{game.name}</span>
                <span className={demo.status}>{describe(game)}</span>
              </li>
            ))}
          </ul>
        )}
        {context && context.games.length === 0 ? (
          <p className={demo.status}>
            This competition is followed for its football; no game has been joined.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={demo.column}>
      <div className={demo.panel}>
        <p className={typography.label}>Not built · placeholder</p>
        <p className={demo.status}>
          {STUB_COPY[destination]}
          {context ? ` Currently scoped to ${context.competition.name}.` : ''}
        </p>
      </div>
    </div>
  )
}

const STUB_COPY: Readonly<Record<ShellDestinationId, string>> = {
  home: 'Home answers “what should I care about right now?” for this competition. The real one is under vNext/Home.',
  matches: 'This competition’s football — fixtures, results and the Match Centre. Stage 8.',
  games: '',
  leagues: 'Private leagues and the people in them, for this competition. Stage 9+.',
}

/**
 * ONE STATUS LINE PER GAME, AND THEY ARE NOT INTERCHANGEABLE.
 *
 * A progress fraction, a survival state and a table position are three
 * different sentences. Writing one `{ headline, detail }` renderer for all
 * three is precisely how Last Man Standing became "another little tab".
 */
function describe(game: ShellGame): string {
  if (game.summary === null) return 'Not joined'
  switch (game.summary.kind) {
    case 'match-predictor':
      return `${game.summary.made} of ${game.summary.of} predictions${
        game.summary.deadlineLabel ? ` · ${game.summary.deadlineLabel}` : ''
      }`
    case 'last-man-standing':
      return game.summary.life === 'alive'
        ? `Still in${game.summary.selection ? ` · ${game.summary.selection}` : ''}${
            game.summary.deadlineLabel ? ` · ${game.summary.deadlineLabel}` : ''
          }`
        : game.summary.life === 'eliminated'
          ? 'Eliminated'
          : 'Not entered'
    default:
      return `${game.summary.position} of ${game.summary.of}${
        game.summary.nextOpponent ? ` · next: ${game.summary.nextOpponent}` : ''
      }`
  }
}

/* ========================================================================== *
 * The harness
 * ========================================================================== */

/**
 * THE HOST THE SHELL SPEAKS TO, AND THE PROOF THAT IT IS ROUTE-AGNOSTIC.
 *
 * Every control in the shell emits a `ShellIntent`; this is one host deciding
 * what those mean, in fourteen lines of `useState`. In the dev harness it is a
 * state hook beside the connected page; after the cutover stage it will be a
 * router. The shell holds no URL and imports no router, which is why all three
 * are possible without changing it.
 *
 * A `discover` or `account` intent has nowhere to go in a fixture-only board,
 * so it is REPORTED rather than faked. A placeholder page pretending to be the
 * catalogue would be a design nobody asked for.
 */
function ShellHarness({
  scenario,
  children,
  initialDestination = 'home',
}: {
  scenario: ShellScenarioName
  children?: (model: VNextShellModel, destination: ShellDestinationId) => ReactNode
  initialDestination?: ShellDestinationId
}) {
  const base = shellScenarios[scenario]
  const [activeContextId, setActiveContextId] = useState(base.activeContextId)
  const [destination, setDestination] = useState<ShellDestinationId>(initialDestination)
  const [went, setWent] = useState<string | null>(null)

  const model = useMemo<VNextShellModel>(
    () => ({ ...base, activeContextId }),
    [base, activeContextId],
  )

  function onIntent(intent: ShellIntent) {
    switch (intent.kind) {
      case 'destination':
        setDestination(intent.destination)
        setWent(null)
        return
      case 'context': {
        // SWITCHING KEEPS THE PLAYER DOING WHAT THEY WERE DOING, which is the
        // production authority's own rule for the legacy masthead selector and
        // the single most consequential behaviour in this architecture. The
        // destination survives the switch; only the football changes.
        setActiveContextId(intent.contextId)
        setWent(null)
        return
      }
      case 'game': {
        setActiveContextId(intent.contextId)
        setDestination('games')
        setWent(
          `${shellContextById(model, intent.contextId)?.competition.name ?? intent.contextId} · ${
            SHELL_GAME_NAMES[intent.game]
          }`,
        )
        return
      }
      case 'league':
        setActiveContextId(intent.contextId)
        setDestination('leagues')
        setWent(intent.leagueId)
        return
      case 'discover':
        setWent('Explore competitions — the catalogue, which this stage does not build')
        return
      default:
        setWent('Account — the player surface, which this stage does not build')
    }
  }

  const context = shellActiveContext(model)

  /**
   * A REAL PAGE RENDERS ITS OWN SHELL, AND THE HARNESS MUST NOT RENDER A SECOND.
   *
   * `VNextHome` and `VNextMatchPredictor` each start with `VNextShell` — that is
   * Stage 5's shape and it is right. Wrapping one of them in another shell gives
   * the frame two `<main>` landmarks, two primary navigations and two mastheads,
   * and it LOOKS almost plausible in a screenshot. The world reaches the page's
   * own shell through the provider, which is exactly how the connected
   * integration does it.
   */
  if (children) {
    return (
      <VNextShellProvider model={model} onIntent={onIntent}>
        {children(model, destination)}
      </VNextShellProvider>
    )
  }

  return (
    <VNextShellProvider model={model} onIntent={onIntent}>
      <VNextShell
        destination={destination}
        header={
          <VNextPageHeader
            title={DESTINATION_TITLES[destination]}
            competition={
              context
                ? `${context.competition.name}${
                    context.competition.seasonLabel
                      ? ` · ${context.competition.seasonLabel}`
                      : ''
                  }`
                : 'No competition'
            }
            context={went ?? undefined}
          />
        }
      >
        <DestinationStub model={model} destination={destination} />
      </VNextShell>
    </VNextShellProvider>
  )
}

/** A board of one scenario across the widths it should be judged at. */
function board(scenario: ShellScenarioName, widths: readonly string[], scale = 1): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={widths} scale={scale}>
        <ShellHarness scenario={scenario} />
      </WorkshopCanvas>
    ),
    parameters: {
      docs: { description: { story: shellScenarioPremises[scenario] } },
    },
  }
}

/** One scenario at one width — the addressable frames the browser suite reads. */
function frame(
  scenario: ShellScenarioName,
  viewport: string,
  initialDestination: ShellDestinationId = 'home',
): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <ShellHarness scenario={scenario} initialDestination={initialDestination} />
      </WorkshopCanvas>
    ),
  }
}

/* ========================================================================== *
 * 1–10. The scenario boards — the human review surface
 * ========================================================================== */

/**
 * THE BINDING PRODUCT TEST. One competition, at a phone and at a desktop.
 *
 * There must be NO switcher — the Premier League is a label and pressing it
 * does nothing, because a control offering one choice teaches a player there is
 * a decision and then proves there is not. There must be no "Your competitions"
 * group. No other competition's name may appear anywhere in the permanent
 * chrome. And Explore must still be one press away at both widths, because the
 * catalogue is not the player's competitions and never was.
 */
export const OneCompetition: Story = board('oneCompetition', ALL_WIDTHS, 0.42)

/** Four competitions, with six predictions locking elsewhere in 41 minutes. */
export const FourCompetitions: Story = board('fourCompetitions', ALL_WIDTHS, 0.42)

/** Twelve competitions: the rail shows six and a count, and Jump appears. */
export const TenPlusCompetitions: Story = board('manyCompetitions', ALL_WIDTHS, 0.42)

/**
 * TWENTY PUBLISHED, THREE RELEVANT.
 *
 * Put this beside `One competition` at 1440. The chrome should differ by three
 * rail rows and nothing else — no catalogue, no logo wall, no twenty-section
 * Home. The platform's size is behind one Explore control.
 */
export const PlatformScale: Story = board('platformScale', ALL_WIDTHS, 0.42)

/** Urgent work in a competition the player is not looking at. */
export const UrgentElsewhere: Story = board('fourCompetitions', ['phone-375', 'laptop-1440'])

/** Live football in a competition the player is not looking at. */
export const LiveElsewhere: Story = board('liveElsewhere', ['phone-375', 'laptop-1440'])

/**
 * A QUIET DAY. Nothing waiting anywhere.
 *
 * The attention layer must render NOTHING — not a zero, not a greyed bell, not
 * an "all caught up" strip. Permanent chrome that says "0" is chrome that has
 * to be read every time to learn it has nothing to say.
 */
export const QuietDay: Story = board('quietDay', ['phone-375', 'laptop-1440'])

/** A new account that has followed nothing. A real state, not a failure. */
export const NoCompetitions: Story = board('noCompetitions', ['phone-375', 'laptop-1440'])

/**
 * A COMPETITION THAT RUNS NO LAST MAN STANDING.
 *
 * Open `Games`: LMS is ABSENT, not greyed and not refusing. A control that
 * exists and refuses teaches a player the product is broken.
 */
export const UnsupportedGame: Story = frameless('unsupportedGame', 'games')

/**
 * LONG NAMES EVERYWHERE — competition, player and private league at once.
 *
 * Nothing may clip and nothing may scroll sideways at any width. The unbroken
 * word in the competition name is deliberate: it is the case a soft break
 * cannot save, and `overflow-wrap: anywhere` is what handles it.
 */
export const LongNames: Story = board('longNames', ALL_WIDTHS, 0.42)

function frameless(scenario: ShellScenarioName, destination: ShellDestinationId): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={['phone-375', 'laptop-1440']}>
        <ShellHarness scenario={scenario} initialDestination={destination} />
      </WorkshopCanvas>
    ),
    parameters: {
      docs: { description: { story: shellScenarioPremises[scenario] } },
    },
  }
}

/* ========================================================================== *
 * 11–13. The two real pages, and reduced motion
 * ========================================================================== */

/**
 * THE STAGE 7 PREDICTOR, WIRED TO ITS OWN REHEARSAL — the same harness
 * `vNext/Match Predictor` uses, because a predictor handed no-op actions would
 * show every state and prove nothing about entering a score inside this shell.
 * The page is unmodified; only the state lives out here, exactly as the real
 * integration has it.
 */
function RehearsedPredictor() {
  const [model, setModel] = useState<PredictorModel>(openPredictorModel)
  const actions: PredictorActions = {
    setPrediction: (fixtureId, score) =>
      setModel((current) => rehearsePredictor(current, { kind: 'setPrediction', fixtureId, score })),
    clearPrediction: (fixtureId) =>
      setModel((current) => rehearsePredictor(current, { kind: 'clearPrediction', fixtureId })),
    setJoker: (played) =>
      setModel((current) => rehearsePredictor(current, { kind: 'setJoker', played })),
    confirmCard: () => setModel((current) => rehearsePredictor(current, { kind: 'confirmCard' })),
    retrySave: () => setModel(openPredictorModel),
    reload: () => setModel(openPredictorModel),
    refreshAfterDeadline: () => setModel(openPredictorModel),
  }
  return <VNextMatchPredictor model={model} actions={actions} />
}

/**
 * THE GOLD STANDARD HOME, UNMODIFIED, INSIDE THE SELECTED SHELL.
 *
 * `src/vnext/home/**` was not redesigned in this stage. What changed is what is
 * AROUND it: a competition rail at 1440 instead of a masthead band of platform
 * destinations. The division of labour is the thing to check —
 *
 *   the shell answers WHERE AM I;
 *   Home answers WHAT MATTERS HERE.
 *
 * The competition should be stated ONCE, by the shell. Home's masthead states
 * the matchweek, which is the thing inside the competition — not the
 * competition again.
 */
export const HomeInsideACompetition: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['phone-375', 'laptop-1440']}>
      <ShellHarness scenario="oneCompetition">
        {() => <VNextHome model={homeScenarios.live} />}
      </ShellHarness>
    </WorkshopCanvas>
  ),
}

/**
 * THE SAME HOME IN A FOUR-COMPETITION WORLD.
 *
 * The page is identical; the chrome gained a switcher and an attention strip.
 * That is the whole claim of the migration — Home did not have to know.
 */
export const HomeWithFourCompetitions: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['phone-375', 'laptop-1440']}>
      <ShellHarness scenario="fourCompetitions">
        {() => <VNextHome model={homeScenarios.live} />}
      </ShellHarness>
    </WorkshopCanvas>
  ),
}

/**
 * THE STAGE 7 MATCH PREDICTOR, UNMODIFIED, INSIDE THE SELECTED SHELL.
 *
 * The hardest integration test in the stage, because the predictor is the page
 * with the least room to spare: a phone entering ten scores must not be cramped
 * by chrome, and at 1920 the working column must still take two fixtures
 * across. Both are measured in `e2e/vnext-shell.spec.ts` and
 * `e2e/vnext-predictor.spec.ts`.
 *
 * WHAT TO CHECK BY EYE. The competition is obvious and stated once; the GAME is
 * obvious — the predictor's own `<h1>` says Match Predictor and the navigation
 * marks `Games` as current, which is the hierarchy working; and the way back to
 * this competition's game list is one press.
 */
export const PredictorInsideACompetition: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} viewports={['phone-375', 'laptop-1440']}>
      <ShellHarness scenario="oneCompetition" initialDestination="games">
        {() => <RehearsedPredictor />}
      </ShellHarness>
    </WorkshopCanvas>
  ),
}

/**
 * REDUCED MOTION. The same shell with every entrance resolved to its reduced
 * pair — the masthead does not travel, the navigation marker does not slide
 * between destinations, and an overlay fades rather than rising.
 *
 * NOTHING IS LOST. Reduced motion changes how things arrive and never what is
 * on screen; `tests/vnext/shell.test.tsx` asserts the text is identical on both
 * paths, so a reviewer here is checking the feel rather than the content.
 */
export const ReducedMotion: Story = {
  render: (args) => (
    <WorkshopCanvas {...args} motion="reduced" viewports={['phone-375', 'laptop-1440']}>
      <ShellHarness scenario="fourCompetitions" />
    </WorkshopCanvas>
  ),
}

/* ========================================================================== *
 * The measured frames — one scenario, one width, for the browser suite
 * ========================================================================== */

export const One375: Story = frame('oneCompetition', 'phone-375')
export const One430: Story = frame('oneCompetition', 'phone-430')
export const One768: Story = frame('oneCompetition', 'tablet-768')
export const One1024: Story = frame('oneCompetition', 'laptop-1024')
export const One1440: Story = frame('oneCompetition', 'laptop-1440')
export const One1920: Story = frame('oneCompetition', 'desktop-1920')

export const Four375: Story = frame('fourCompetitions', 'phone-375')
export const Four430: Story = frame('fourCompetitions', 'phone-430')
export const Four768: Story = frame('fourCompetitions', 'tablet-768')
export const Four1024: Story = frame('fourCompetitions', 'laptop-1024')
export const Four1440: Story = frame('fourCompetitions', 'laptop-1440')
export const Four1920: Story = frame('fourCompetitions', 'desktop-1920')

export const Many375: Story = frame('manyCompetitions', 'phone-375')
export const Many1440: Story = frame('manyCompetitions', 'laptop-1440')
export const Many1920: Story = frame('manyCompetitions', 'desktop-1920')

export const Platform375: Story = frame('platformScale', 'phone-375')
export const Platform1440: Story = frame('platformScale', 'laptop-1440')

export const Quiet375: Story = frame('quietDay', 'phone-375')
export const Quiet1440: Story = frame('quietDay', 'laptop-1440')

export const Live1440: Story = frame('liveElsewhere', 'laptop-1440')

export const None375: Story = frame('noCompetitions', 'phone-375')
export const None1440: Story = frame('noCompetitions', 'laptop-1440')

export const Unsupported375: Story = frame('unsupportedGame', 'phone-375', 'games')
export const Unsupported1440: Story = frame('unsupportedGame', 'laptop-1440', 'games')

export const Long375: Story = frame('longNames', 'phone-375')
export const Long430: Story = frame('longNames', 'phone-430')
export const Long1440: Story = frame('longNames', 'laptop-1440')
export const Long1920: Story = frame('longNames', 'desktop-1920')

/** The Gold Standard Home inside the selected shell, at each measured width. */
function homeFrame(scenario: ShellScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <ShellHarness scenario={scenario}>
          {() => <VNextHome model={homeScenarios.live} />}
        </ShellHarness>
      </WorkshopCanvas>
    ),
  }
}

export const HomeOne375: Story = homeFrame('oneCompetition', 'phone-375')
export const HomeOne1440: Story = homeFrame('oneCompetition', 'laptop-1440')
export const HomeFour375: Story = homeFrame('fourCompetitions', 'phone-375')
export const HomeFour1440: Story = homeFrame('fourCompetitions', 'laptop-1440')
export const HomeFour1920: Story = homeFrame('fourCompetitions', 'desktop-1920')

/** The Stage 7 Match Predictor inside the selected shell, at each width. */
function predictorFrame(scenario: ShellScenarioName, viewport: string): Story {
  return {
    render: (args) => (
      <WorkshopCanvas {...args} viewports={[viewport]}>
        <ShellHarness scenario={scenario} initialDestination="games">
          {() => <RehearsedPredictor />}
        </ShellHarness>
      </WorkshopCanvas>
    ),
  }
}

export const PredictorOne375: Story = predictorFrame('oneCompetition', 'phone-375')
export const PredictorOne1440: Story = predictorFrame('oneCompetition', 'laptop-1440')
export const PredictorFour375: Story = predictorFrame('fourCompetitions', 'phone-375')
export const PredictorFour1440: Story = predictorFrame('fourCompetitions', 'laptop-1440')
export const PredictorFour1920: Story = predictorFrame('fourCompetitions', 'desktop-1920')
