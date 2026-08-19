import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../../src/services/supabase/client', () => ({ db: { rpc: mocks.rpc } }))

import {
  dismissMyAction,
  fetchMyActions,
  markMyActionsSeen,
  mapPlayerActionsFeed,
} from '../../src/services/supabase/playerActions'

function payload() {
  return {
    unseen: 1,
    limit: 20,
    actions: [
      {
        ordinal: 1,
        action_key: 'action-1',
        action_type: 'matchweek_predictions_due',
        priority: 2,
        tournament_id: 'season-1',
        competition_id: null,
        deadline_at: '2026-08-21T18:00:00Z',
        expires_at: '2026-08-21T18:00:00Z',
        context: { matchweek: 2 },
        seen: false,
        seen_at: null,
        dismissed: false,
        generated_at: '2026-08-18T12:00:00Z',
      },
    ],
  }
}

describe('persistent player action services', () => {
  beforeEach(() => mocks.rpc.mockReset())

  it('reads the bounded undismissed canonical feed', async () => {
    mocks.rpc.mockResolvedValue({ data: payload(), error: null })
    const feed = await fetchMyActions()
    expect(mocks.rpc).toHaveBeenCalledWith('get_my_actions', {
      p_limit: 20,
      p_include_dismissed: false,
    })
    expect(feed.actions[0]).toMatchObject({
      actionKey: 'action-1',
      actionType: 'matchweek_predictions_due',
      seen: false,
    })
  })

  it('preserves an unfamiliar future server action instead of silently dropping it', () => {
    const next = payload()
    next.actions[0]!.action_type = 'future_server_event'
    expect(mapPlayerActionsFeed(next).actions[0]?.actionType).toBe('future_server_event')
  })

  it('writes seen state through the canonical command', async () => {
    mocks.rpc.mockResolvedValue({ data: { marked: 2 }, error: null })
    await markMyActionsSeen(['a', 'b'])
    expect(mocks.rpc).toHaveBeenCalledWith('mark_actions_seen', {
      p_action_keys: ['a', 'b'],
    })
  })

  it('does not call the server for an empty seen set', async () => {
    await markMyActionsSeen([])
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('dismisses exactly one server-issued key', async () => {
    mocks.rpc.mockResolvedValue({ data: { dismissed: true }, error: null })
    await dismissMyAction('action-1')
    expect(mocks.rpc).toHaveBeenCalledWith('dismiss_action', { p_action_key: 'action-1' })
  })
})
