import { describe, expect, it, vi } from 'vitest'
import { expectNoAxeViolations } from './vnextAxe'
import { fireEvent, render, screen } from '@testing-library/react'
import { VNextInvite } from '../../src/vnext/invite/VNextInvite'
import { VNextShellProvider } from '../../src/vnext/app/VNextShellProvider'
import { inviteScenarioNames, inviteScenarios, shellScenarios } from '../../src/vnext/fixtures'
import type { InvitePageModel } from '../../src/vnext/models/invite'

function renderInvite(
  model: InvitePageModel,
  props: { onIntent?: (intent: { kind: string }) => void } = {},
) {
  return render(
    <VNextShellProvider model={shellScenarios.oneCompetition}>
      <VNextInvite model={model} {...props} />
    </VNextShellProvider>,
  )
}

const zone = (name: string) =>
  document.querySelector(`[data-vnext-zone="${name}"]`) as HTMLElement | null

/**
 * The one card, so shell controls are never mistaken for the page's. Matched by
 * the zones this page actually owns — the shell marks zones of its own, and the
 * first `[data-vnext-zone]` in the document is not necessarily ours.
 */
const card = (container: HTMLElement) =>
  container.querySelector(
    '[data-vnext-zone="invite"], [data-vnext-zone="not-found"], [data-vnext-zone="failed"], [data-vnext-zone="looking"]',
  ) as HTMLElement

describe('every world is a page', () => {
  it.each(inviteScenarioNames)('%s has one main and one h1', (name) => {
    renderInvite(inviteScenarios[name])
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it.each(inviteScenarioNames)('%s lights no destination', (name) => {
    const { container } = renderInvite(inviteScenarios[name])
    expect([...container.querySelectorAll('[aria-current]')]).toEqual([])
  })
})

describe('no accept control exists where the server would refuse', () => {
  it.each(['alreadyIn', 'owner', 'closed', 'needsGameFirst', 'needsUnnamedGame'] as const)(
    '%s offers no accept, and not a disabled one either',
    (name) => {
      const { container } = renderInvite(inviteScenarios[name])
      const within = card(container)
      expect(within.querySelector('button[disabled]')).toBeNull()
      expect(
        [...within.querySelectorAll('button')].some((b) => /accept/i.test(b.textContent ?? '')),
      ).toBe(false)
    },
  )

  it('offers accept where the invite can be accepted', () => {
    renderInvite(inviteScenarios.leagueOpen)
    expect(screen.getByRole('button', { name: /accept invitation/i })).toBeInTheDocument()
  })

  it('emits accept once', () => {
    const onIntent = vi.fn()
    renderInvite(inviteScenarios.competitionOpen, { onIntent })
    fireEvent.click(screen.getByRole('button', { name: /accept invitation/i }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'accept' })
  })

  it('disables only while an accept is in flight', () => {
    renderInvite(inviteScenarios.accepting)
    expect(screen.getByRole('button', { name: /joining/i })).toBeDisabled()
  })
})

describe('a league that needs its game first sends the player to the game', () => {
  it('names the game where the read named it', () => {
    renderInvite(inviteScenarios.needsGameFirst)
    expect(zone('refusal')?.textContent).toMatch(/playing Match Predictor before/i)
    expect(screen.getByRole('button', { name: /go to Match Predictor/i })).toBeInTheDocument()
  })

  it('does not invent a name where the read had none', () => {
    const { container } = renderInvite(inviteScenarios.needsUnnamedGame)
    expect(zone('refusal')?.textContent).toMatch(/this league’s game/i)
    expect(container.textContent).not.toMatch(/Go to null|Go to undefined/)
  })

  it('emits open-game rather than accept', () => {
    const onIntent = vi.fn()
    renderInvite(inviteScenarios.needsGameFirst, { onIntent })
    fireEvent.click(screen.getByRole('button', { name: /go to Match Predictor/i }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'open-game' })
  })
})

describe('each refusal is its own sentence', () => {
  it('says already-in without calling it ownership', () => {
    renderInvite(inviteScenarios.alreadyIn)
    expect(zone('refusal')?.textContent).toMatch(/already in this one/i)
    expect(zone('refusal')?.textContent).not.toMatch(/you set it up/i)
  })

  it('says ownership without calling it already-in', () => {
    renderInvite(inviteScenarios.owner)
    expect(zone('refusal')?.textContent).toMatch(/yours — you set it up/i)
  })

  it('says closed without blaming the player', () => {
    renderInvite(inviteScenarios.closed)
    expect(zone('refusal')?.textContent).toMatch(/no longer taking entries/i)
  })
})

describe('a code that resolved to nothing gets one sentence and no diagnosis', () => {
  it('offers no explanation of why the code failed', () => {
    const { container } = renderInvite(inviteScenarios.notFound)
    const text = container.textContent ?? ''
    // Unknown, malformed and rotated codes are indistinguishable by design.
    expect(text).not.toMatch(/expired|revoked|does not exist|invalid characters|too short/i)
    expect(text).toMatch(/not valid/i)
  })

  it('offers a way out rather than a retry, because retrying will not help', () => {
    renderInvite(inviteScenarios.notFound)
    expect(screen.getByRole('button', { name: /go to home/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull()
  })

  it('offers a retry for a lookup that failed, which is the retryable one', () => {
    const onIntent = vi.fn()
    renderInvite(inviteScenarios.failed, { onIntent })
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onIntent).toHaveBeenCalledWith({ kind: 'retry' })
  })

  it('carries the failure’s own sentence rather than re-wording it', () => {
    renderInvite(inviteScenarios.failed)
    expect(zone('failed')?.textContent).toContain('Something went wrong. Please try again.')
  })
})

describe('the invitation is described in the words the read supplied', () => {
  it('names what kind of thing it is', () => {
    const { container } = renderInvite(inviteScenarios.leagueOpen)
    expect(container.textContent).toContain('A private league')
    expect(card(container).getAttribute('data-container')).toBe('league')
  })

  it('shows the game and season together where both exist', () => {
    renderInvite(inviteScenarios.competitionOpen)
    expect(zone('subtitle')?.textContent).toBe(
      'Predictor Championship · Caledonian Premiership 2027/28',
    )
  })

  it('drops the game and keeps the season, with no dangling separator', () => {
    // The old assertion here was that a subtitle disappears when NEITHER exists
    // — against a fixture that made a competition invite with a null season.
    // `resolve_invite_code` inner-joins `tournaments` in both branches, so a
    // resolved invite always has a season; only a league's game can be null.
    // The reachable case is therefore one part, not none.
    renderInvite(inviteScenarios.bareInvite)
    expect(zone('subtitle')?.textContent).toBe('Caledonian Premiership 2027/28')
    expect(zone('subtitle')?.textContent).not.toContain('·')
  })

  it('never clips a long name', () => {
    const { container } = renderInvite(inviteScenarios.longName)
    expect(container.textContent).toContain(
      'The Royal Caledonian and Borders Office Championship Invitational 2027/28',
    )
  })
})


describe('every world passes the accessibility scan', () => {
  it.each(inviteScenarioNames)('%s has no critical or serious violation', async (name) => {
    await expectNoAxeViolations(
      <VNextShellProvider model={shellScenarios.oneCompetition}>
        <VNextInvite model={inviteScenarios[name]} />
      </VNextShellProvider>,
    )
  })
})

describe('no world depicts a payload the resolver cannot produce', () => {
  /**
   * THE LAWFULNESS CHECK the other Stage 13 surfaces carry and this one did
   * not. `resolve_invite_code`'s competition branch is
   *
   *   from bonus_competitions
   *   join tournaments      on season.id = competition.tournament_id
   *   join game_definitions on definition.game_key = competition.game_key
   *
   * with `tournaments.name` and `game_definitions.display_name` both `not
   * null`. So a COMPETITION invite that resolved carries both a season and a
   * game name; one that did not resolve has a null `name` and decodes to
   * `found: false` long before it reaches a model. The league branch left-joins
   * the competition and its definition, so only a LEAGUE can come back with an
   * unnamed game — and `tournaments` is inner-joined in both branches, so
   * neither can come back with an unnamed season.
   */
  it.each(inviteScenarioNames)('%s could have come from the server', (name) => {
    const panel = inviteScenarios[name].panel
    if (panel.kind !== 'invite') return
    const details = panel.details

    expect(details.season).not.toBeNull()

    if (details.container === 'competition') {
      expect(details.game).not.toBeNull()
    }
  })
})

describe('the lookup announces itself rather than being a silent pause', () => {
  it('marks the card busy and live while the code is being resolved', () => {
    // Removing both attributes passed the whole file, which made "it announces
    // itself" a claim in a comment rather than a property of the component. A
    // player using a screen reader gets no signal at all without them.
    renderInvite(inviteScenarios.looking)
    const card = zone('looking')
    expect(card).toHaveAttribute('aria-busy', 'true')
    expect(card).toHaveAttribute('aria-live', 'polite')
  })
})
