import { fireEvent, render, screen, within } from '@testing-library/react'
import axe from 'axe-core'
import type { ReactElement } from 'react'
import { describe, expect, it } from 'vitest'
import { ChoiceSheet } from '../../src/design-system/ChoiceSheet'
import { EmptyState } from '../../src/design-system/EmptyState'
import { JokerButton } from '../../src/design-system/JokerButton'
import { LeagueTable } from '../../src/design-system/LeagueTable'
import { ConfirmModal, Modal } from '../../src/design-system/Modal'
import { ScoreInput } from '../../src/design-system/ScoreInput'
import { TextInput } from '../../src/design-system/TextInput'
import { TieResolver } from '../../src/design-system/TieResolver'

/**
 * Accessibility of the component states the gallery cannot show.
 *
 * `axeComponentPreview.test.tsx` scans every component at once, but only in the
 * single state `ComponentsPreview` renders. For most components that is the
 * whole story. For these it is not: `ModalDemo` starts with both modals closed,
 * so no scan anywhere had ever seen an open dialog — the state where dialog
 * accessibility is the entire question. `ChoiceSheet` is the same, rendering as
 * a closed trigger until clicked.
 *
 * The rest are states a route scan is unlikely to catch either: a field showing
 * its error, a score box after the deadline locks it, a league table with a
 * split divider and positional zones.
 *
 * Nothing here is currently failing. It is written because this class of defect
 * recurs and is invisible until something looks: `ThirdPlaceTable`'s critical
 * `aria-required-children` and `ProgressBar`'s missing name were both found the
 * first time a scan reached the state that contained them, and both had been
 * shipping.
 *
 * Every case asserts the state actually materialised before scanning. A dialog
 * that failed to open scans a closed trigger and reports clean, which is the
 * failure this file would otherwise be a very convincing example of.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
const FAIL_IMPACTS = new Set(['critical', 'serious'])

/**
 * `incomplete` counts as failing here, for the reason set out in
 * `axeComponentPreview.test.tsx`: it is where axe puts findings it could not
 * decide, and reading only `violations` is how a critical `duplicate-id-aria`
 * and a serious `aria-prohibited-attr` sat unreported. `color-contrast` is the
 * one exception, because jsdom has no layout to measure it against.
 */
const JSDOM_CANNOT_EVALUATE = new Set(['color-contrast'])

/**
 * Renders, lets the caller drive the component into the state and assert it is
 * there, then scans.
 *
 * `document.body` rather than the render container: `Modal` renders its overlay
 * inline today, but scanning the body keeps the check correct if it ever moves
 * to a portal, which is the normal thing for a dialog to do.
 */
async function scanState(ui: ReactElement, reach: () => void) {
  const { unmount } = render(ui)

  try {
    reach()

    const results = await axe.run(document.body, { runOnly: { type: 'tag', values: TAGS } })
    const failing = [
      ...results.violations,
      ...results.incomplete.filter((result) => !JSDOM_CANNOT_EVALUATE.has(result.id)),
    ].filter((result) => result.impact && FAIL_IMPACTS.has(result.impact))

    expect(
      failing,
      failing
        .map(
          (violation) =>
            `${violation.id} (${violation.impact}): ${violation.help} — ${violation.nodes
              .slice(0, 3)
              .map((node) => node.html.slice(0, 140))
              .join(' | ')}`,
        )
        .join('\n'),
    ).toEqual([])
  } finally {
    unmount()
  }
}

const CLUB = { monogram: 'ABC', primary: '#EF0107' }

const OPTIONS = [
  { value: 'pens', label: 'Penalties' },
  { value: 'aet', label: 'Extra time' },
]

describe('component states the gallery does not render', () => {
  it('Modal, open', async () => {
    await scanState(
      <Modal open onClose={() => {}} title="Clear predictions?">
        <p>This cannot be undone.</p>
      </Modal>,
      () => {
        expect(screen.getByRole('dialog', { name: 'Clear predictions?' })).toBeInTheDocument()
      },
    )
  })

  it('ConfirmModal, open and destructive', async () => {
    await scanState(
      <ConfirmModal
        open
        onClose={() => {}}
        onConfirm={() => {}}
        title="Sign out?"
        confirmLabel="Sign out"
        destructive
      >
        <p>You will need to log in again.</p>
      </ConfirmModal>,
      () => {
        const dialog = screen.getByRole('dialog', { name: 'Sign out?' })
        // Both actions must be present: a confirm dialog with one reachable
        // button is a different defect, and the scan would not object to it.
        expect(within(dialog).getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      },
    )
  })

  it('ChoiceSheet, opened by the user', async () => {
    await scanState(
      <ChoiceSheet label="Result method" value="pens" options={OPTIONS} onChange={() => {}} />,
      () => {
        fireEvent.click(screen.getByRole('button', { name: 'Penalties' }))

        const dialog = screen.getByRole('dialog', { name: 'Result method' })
        // The radio group is the point: the sheet is a select rebuilt out of
        // divs and buttons, so its semantics exist only as hand-written roles.
        expect(within(dialog).getByRole('radiogroup', { name: 'Result method' })).toBeInTheDocument()
        expect(within(dialog).getAllByRole('radio')).toHaveLength(OPTIONS.length)
      },
    )
  })

  it('TextInput, showing a validation error', async () => {
    await scanState(
      <TextInput
        label="Email"
        value="nope"
        onChange={() => {}}
        error="That email isn't right"
      />,
      () => {
        // The message has to reach the field, not merely the page.
        expect(
          screen.getByRole('textbox', { name: 'Email', description: "That email isn't right" }),
        ).toBeInTheDocument()
      },
    )
  })

  it('TextInput, password with the reveal control', async () => {
    await scanState(
      <TextInput label="Password" type="password" value="hunter2" onChange={() => {}} />,
      () => {
        expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
      },
    )
  })

  it('ScoreInput, locked after the deadline', async () => {
    await scanState(<ScoreInput value={2} ariaLabel="Scotland score" locked />, () => {
      // Locked renders a static chip rather than a field, so the assertion is
      // that the textbox is gone and the value is still announced.
      expect(screen.queryByRole('textbox')).toBeNull()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('EmptyState', async () => {
    await scanState(
      <EmptyState title="No leagues yet" description="Join one with an invite code." />,
      () => {
        expect(screen.getByText('No leagues yet')).toBeInTheDocument()
      },
    )
  })

  it('JokerButton, played', async () => {
    await scanState(<JokerButton state="on" onToggle={() => {}} />, () => {
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  it('TieResolver, awaiting a decision', async () => {
    await scanState(
      <TieResolver
        title="Group A needs your decision"
        reason="Two teams are level on every tiebreak."
        teams={[
          { id: 'eng', name: 'England', countryCode: 'gb-eng' },
          { id: 'fra', name: 'France', countryCode: 'fr' },
        ]}
        resolved={false}
        onResolve={() => {}}
      />,
      () => {
        // The reorder controls are icon buttons, which is the shape that most
        // often ships without a name.
        expect(screen.getByRole('button', { name: 'Move France up' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Move England down' })).toBeInTheDocument()
      },
    )
  })

  it('LeagueTable, split with positional zones', async () => {
    await scanState(
      <LeagueTable
        caption="Scottish Premiership"
        rows={[1, 2, 3, 4].map((position) => ({
          position,
          name: `Club ${position}`,
          club: CLUB,
          played: 33,
          goalDifference: 0,
          points: 40,
        }))}
        splitAfter={2}
        splitLabels={{ top: 'Top half', bottom: 'Bottom half' }}
        zones={[{ from: 1, to: 1, kind: 'champion', label: 'Champion' }]}
      />,
      () => {
        expect(screen.getByText('Bottom half')).toBeInTheDocument()
      },
    )
  })

  it('LeagueTable, with position movement arrows', async () => {
    await scanState(
      <LeagueTable
        caption="Premier League"
        rows={[
          { position: 1, name: 'Risen', club: CLUB, played: 33, goalDifference: 0, points: 40, movement: 'up' },
          { position: 2, name: 'Fallen', club: CLUB, played: 33, goalDifference: 0, points: 39, movement: 'down' },
          { position: 3, name: 'Static', club: CLUB, played: 33, goalDifference: 0, points: 38, movement: 'none' },
        ]}
      />,
      () => {
        // The arrows are the only thing conveying movement, so they need a name
        // that reaches the accessibility tree. They carried `aria-label` on a
        // roleless span, where ARIA prohibits a name — the glyph was announced
        // and the label was not. Asserted through the accessible name rather
        // than the attribute, so the announcement is what is pinned.
        expect(screen.getByRole('img', { name: 'Up' })).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Down' })).toBeInTheDocument()
        // `none` renders nothing rather than a silent third glyph. Scoped by
        // name: each row's ClubIdentity monogram is also a named `img`, so a
        // bare count here would be counting clubs, not arrows.
        expect(screen.getAllByRole('img', { name: /^(Up|Down)$/ })).toHaveLength(2)
      },
    )
  })

  it('reports a violation when the state contains one', async () => {
    // The harness's own positive control. Every case above passes if `scanState`
    // scans the wrong node, runs no rules, or swallows the result — and each
    // would look exactly like a clean component.
    await expect(
      scanState(
        <div role="table" aria-label="Deliberately wrong">
          <div role="separator" aria-label="Elimination line" />
        </div>,
        () => {
          expect(screen.getByRole('table')).toBeInTheDocument()
        },
      ),
    ).rejects.toThrow(/aria-required-children/)
  })
})
