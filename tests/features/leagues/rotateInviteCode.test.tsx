import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The control's DEFAULT gateway is the real service, so importing it would
// otherwise initialise the Supabase client in a credential-free unit test.
// Every assertion below injects its own `rotate`; nothing here calls the real
// one, and the mock exists only so the module can be imported.
vi.mock('../../../src/services/supabase/leagues', () => ({
  rotateLeagueInviteCode: vi.fn(),
}))

import { RotateInviteCodeControl } from '../../../src/features/leagues/RotateInviteCodeControl'

/**
 * Contract 158's `rotate_league_invite_code`, from the browser.
 *
 * `SEC-001`'s third item was that a leaked invite code should be recoverable
 * without deleting the league. The function shipped and nothing called it, so
 * an owner whose code had got out could only start again.
 */

const LEAGUE = {
  leagueId: 'league-1',
  leagueName: 'The Sunday Lot',
  currentCode: 'ABCD2345EFGH',
}

function renderControl(rotate: (leagueId: string) => Promise<string>) {
  const onRotated = vi.fn()
  render(<RotateInviteCodeControl {...LEAGUE} onRotated={onRotated} rotate={rotate} />)
  return { onRotated }
}

describe('rotating an invite code', () => {
  it('does nothing until the owner confirms', async () => {
    const rotate = vi.fn().mockResolvedValue('NEWCODE12345')
    renderControl(rotate)

    fireEvent.click(screen.getByRole('button', { name: 'New invite code' }))
    expect(rotate).not.toHaveBeenCalled()
  })

  // The consequence, in the terms it has for a real person, rather than
  // "are you sure?".
  it('names the code it is about to break, and says it cannot be undone', async () => {
    renderControl(vi.fn())

    fireEvent.click(screen.getByRole('button', { name: 'New invite code' }))
    const warning = screen.getByRole('group')
    expect(warning).toHaveTextContent('ABCD2345EFGH will stop working')
    expect(warning).toHaveTextContent(/cannot be put back/i)
    expect(warning).toHaveTextContent(/Members already in the league are not affected/i)
  })

  it('lets the owner back out, keeping the code they have', async () => {
    const rotate = vi.fn()
    renderControl(rotate)

    fireEvent.click(screen.getByRole('button', { name: 'New invite code' }))
    fireEvent.click(screen.getByRole('button', { name: /keep abcd2345efgh/i }))

    expect(rotate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'New invite code' })).toBeInTheDocument()
  })

  it('hands the new code straight back rather than making the caller refetch', async () => {
    const rotate = vi.fn().mockResolvedValue('NEWCODE12345')
    const { onRotated } = renderControl(rotate)

    fireEvent.click(screen.getByRole('button', { name: 'New invite code' }))
    fireEvent.click(screen.getByRole('button', { name: 'Issue a new code' }))

    await waitFor(() => expect(onRotated).toHaveBeenCalledWith('NEWCODE12345'))
    expect(rotate).toHaveBeenCalledWith('league-1')
  })

  it('announces the outcome, because the code chip is elsewhere on the page', async () => {
    renderControl(vi.fn().mockResolvedValue('NEWCODE12345'))

    fireEvent.click(screen.getByRole('button', { name: 'New invite code' }))
    fireEvent.click(screen.getByRole('button', { name: 'Issue a new code' }))

    expect(await screen.findByText(/the old code no longer works/i)).toBeInTheDocument()
  })

  // Hiding the control for a non-owner is presentation, never the control. The
  // server is owner-only inside, and its refusal is SHOWN rather than swallowed
  // — mapped to safe copy, because no raw RPC detail reaches a player.
  it('shows a permission refusal and offers the action again', async () => {
    const rotate = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('rotate_league_invite_code'), {
        code: '42501',
      }))
    const { onRotated } = renderControl(rotate)

    fireEvent.click(screen.getByRole('button', { name: 'New invite code' }))
    fireEvent.click(screen.getByRole('button', { name: 'Issue a new code' }))

    expect(await screen.findByText(/don't have permission/i)).toBeInTheDocument()
    // The plumbing never reaches the player.
    expect(screen.queryByText(/rotate_league_invite_code/)).not.toBeInTheDocument()
    expect(onRotated).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'New invite code' })).toBeInTheDocument()
  })

  it('reports a failure that carries no message rather than falling silent', async () => {
    const rotate = vi.fn().mockRejectedValue(new Error(''))
    renderControl(rotate)

    fireEvent.click(screen.getByRole('button', { name: 'New invite code' }))
    fireEvent.click(screen.getByRole('button', { name: 'Issue a new code' }))

    expect(
      await screen.findByText(/invite code could not be changed|something went wrong/i),
    ).toBeInTheDocument()
  })
})
