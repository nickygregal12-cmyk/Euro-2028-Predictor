import type { ReactElement } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { VNextShell } from '../app/VNextShell'
import { VNextPageHeader } from '../app/VNextPageHeader'
import { defaultNavItems } from '../components/navigation/VNextNav'
import { WorkshopCanvas } from '../workshop/WorkshopCanvas'
import type { VNextMotionSetting } from '../foundations/VNextRoot'
import typography from '../foundations/typography.module.css'
import demo from './Shell.stories.module.css'

/**
 * vNEXT SHELL — DOES IT HOST A PAGE THAT IS NOT HOME?
 *
 * That is the only question this group answers, and the content below is built
 * to answer it and nothing else. **These are not designs.** They are not early
 * drafts of Fixtures, Leagues, Match Centre or the Predictor, they carry no
 * product decisions, and nothing here is an authority for anything. The visual
 * authority for vNext is the Gold Standard Home, under `vNext/Home` — if these
 * two groups ever disagree about type, colour, density or motion, Home is
 * right.
 *
 * The placeholders are deliberately dull for that reason. Content interesting
 * enough to be worth looking at is content someone will treat as a proposal.
 *
 * WHAT EACH DEMONSTRATION IS FOR.
 *
 *   Content   an ordinary editorial page. Proves a page can inset itself with
 *             `--vnext-page-inset` and get the same bounds the masthead has.
 *   Dense     a fourteen-column table. Proves the shell imposes no reading
 *             column: at 1440 and 1920 the table uses the whole workspace, and
 *             the shell never takes width back for chrome.
 *   Detail    one subject with a status in the header's trailing slot. Proves
 *             the slot is composition rather than Home's points panel with a
 *             generic name.
 *
 * Every frame comes from `WorkshopCanvas`, so the shell answers its CONTAINER:
 * a 430px frame composes as a phone on a 1920px monitor, and the `scale` on the
 * wider stories shrinks the picture without shrinking the layout.
 */
const meta = {
  title: 'vNext/Shell',
  component: WorkshopCanvas,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof WorkshopCanvas>

export default meta

/* ---- the placeholders --------------------------------------------------- */

/**
 * An ordinary page: text at a comfortable measure, inset to the page bounds.
 *
 * The inset comes from the shell as `--vnext-page-inset` rather than from a
 * number this page picked, which is the whole contract — a page that hard-codes
 * 16px is a page whose margins stop agreeing with the masthead at 1120.
 */
function ContentPage() {
  return (
    <div className={demo.column}>
      {['First', 'Second', 'Third'].map((name) => (
        <section key={name} className={demo.panel}>
          <h2 className={typography.lead}>{name} placeholder section</h2>
          <p className={typography.body}>
            Placeholder copy standing in for whatever a real page puts here. It
            exists to give the shell something with height and a text measure to
            hold, and it makes no claim about what any vNext page will say.
          </p>
        </section>
      ))}
    </div>
  )
}

/**
 * A wide table, to prove the shell hands a data-dense page the workspace.
 *
 * Fourteen columns is more than any product surface has asked for, on purpose:
 * a shell that survives this survives standings, a fixtures grid and a
 * comparison view. The table scrolls inside its own box rather than pushing the
 * page sideways, which is the same discipline Home's score bar uses.
 */
function DensePage() {
  const columns = Array.from({ length: 14 }, (_, index) => `Col ${index + 1}`)
  const rows = Array.from({ length: 12 }, (_, index) => index + 1)

  return (
    <div className={demo.column}>
      <div className={demo.tableScroller}>
        <table className={demo.table}>
          <caption className={typography.srOnly}>
            A placeholder table demonstrating that the shell imposes no reading
            column
          </caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              {columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th scope="row">Row {row}</th>
                {columns.map((column) => (
                  <td key={column} className={typography.numeric}>
                    {row * column.length}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** One subject, one status. The smallest thing the shell has to hold. */
function DetailPage() {
  return (
    <div className={demo.column}>
      <section className={demo.panel}>
        <h2 className={typography.lead}>Placeholder subject</h2>
        <p className={typography.body}>
          A detail page is one thing and its context. This one is a placeholder
          so the shell can be judged on the frame rather than on the picture.
        </p>
      </section>
      <section className={demo.panel}>
        <h2 className={typography.lead}>Placeholder detail</h2>
        <p className={typography.body}>
          Nothing here is a product decision. The page owns this composition
          entirely; the shell contributed the canvas, the bounds, the navigation
          and the heading.
        </p>
      </section>
    </div>
  )
}

/* ---- the stories -------------------------------------------------------- */

type Demo = 'content' | 'dense' | 'detail'

const HEADERS: Record<Demo, ReactElement> = {
  content: (
    <VNextPageHeader
      competition="Placeholder competition"
      title="Content"
      context="Placeholder context"
    />
  ),
  dense: (
    <VNextPageHeader
      competition="Placeholder competition"
      title="Dense"
      context="Fourteen columns"
    />
  ),
  detail: (
    <VNextPageHeader
      title="Detail"
      context="No competition"
      trailing={
        <p className={`${typography.label} ${demo.status}`}>Placeholder status</p>
      }
    />
  ),
}

const PAGES: Record<Demo, () => ReactElement> = {
  content: ContentPage,
  dense: DensePage,
  detail: DetailPage,
}

function shell(
  page: Demo,
  destination: string,
  viewports: readonly string[],
  scale = 1,
  motion: VNextMotionSetting = 'system',
): StoryObj {
  const Page = PAGES[page]
  return {
    parameters: { layout: 'fullscreen' },
    render: () => (
      <WorkshopCanvas viewports={viewports} scale={scale} motion={motion}>
        <VNextShell destination={destination} header={HEADERS[page]}>
          <Page />
        </VNextShell>
      </WorkshopCanvas>
    ),
  }
}

/* ---- neutral content, at every band ------------------------------------- */

export const Content375: StoryObj = shell('content', 'fixtures', ['phone-375'])

export const Content430: StoryObj = shell('content', 'fixtures', ['phone-430'])

export const Content768: StoryObj = shell('content', 'fixtures', ['tablet-768'], 0.9)

export const Content1440: StoryObj = shell('content', 'fixtures', ['laptop-1440'], 0.8)

export const Content1920: StoryObj = shell('content', 'fixtures', ['desktop-1920'], 0.62)

/* ---- data-dense: the reason the shell has no reading column -------------- */

export const Dense430: StoryObj = shell('dense', 'leagues', ['phone-430'])

export const Dense1440: StoryObj = shell('dense', 'leagues', ['laptop-1440'], 0.8)

/** Where a future standings table has to be able to use the workspace. */
export const Dense1920: StoryObj = shell('dense', 'leagues', ['desktop-1920'], 0.62)

/* ---- detail: the header's trailing slot ---------------------------------- */

export const Detail430: StoryObj = shell('detail', 'season', ['phone-430'])

export const Detail1440: StoryObj = shell('detail', 'season', ['laptop-1440'], 0.8)

/* ---- cross-cutting ------------------------------------------------------- */

/** All five review widths at once. Scaled visually only. */
export const AllWidths: StoryObj = shell(
  'content',
  'fixtures',
  ['phone-375', 'phone-430', 'tablet-768', 'laptop-1440', 'desktop-1920'],
  0.36,
)

/** The reduced-motion path: the masthead arrives without travel. */
export const ReducedMotion: StoryObj = shell(
  'content',
  'fixtures',
  ['phone-430', 'laptop-1440'],
  0.7,
  'reduced',
)

/**
 * LONG AND LOCALISED DESTINATION LABELS.
 *
 * The four English labels are short, which makes the bottom bar look safer than
 * it is. These are the German ones — the longest of them is nearly three times
 * "Home" — and the bar still has to keep four legible labels above four 44px
 * targets at 375px.
 */
export const LongNavigationLabels: StoryObj = {
  parameters: { layout: 'fullscreen' },
  render: () => (
    <WorkshopCanvas viewports={['phone-375', 'phone-430', 'laptop-1440']} scale={0.7}>
      <VNextShell
        destination="fixtures"
        navItems={LONG_LABELS}
        header={
          <VNextPageHeader
            competition="Schottische Premiership"
            title="Spielbegegnungen"
            context="Spielwoche 4"
          />
        }
      >
        <ContentPage />
      </VNextShell>
    </WorkshopCanvas>
  ),
}

const LONG_LABELS = defaultNavItems.map((item, index) => ({
  ...item,
  label: ['Startseite', 'Spielbegegnungen', 'Ligatabellen', 'Saisonübersicht'][index],
}))
