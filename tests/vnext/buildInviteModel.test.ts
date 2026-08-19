import { describe, expect, it } from 'vitest'
import { buildInviteModel } from '../../src/vnext/integration/invite/buildInviteModel'
import type { InviteState } from '../../src/features/leagues/useInviteCode'
import { offersAccept } from '../../src/vnext/models/invite'

/**
 * `InviteState` → `InvitePageModel`.
 *
 *   1. NOT FOUND CARRIES NOTHING. The server made unknown, malformed and
 *      rotated codes indistinguishable; a client that told them apart would
 *      turn an invite code into an oracle for which codes exist.
 *   2. NO BUTTON IS OFFERED THAT THE SERVER WOULD REFUSE — a closed
 *      competition, a league whose game has not been joined, or a container the
 *      player is already in.
 *   3. `closed` IS NEVER RECOMPUTED.
 */

const NOW = '2027-08-01T12:00:00.000Z'
const opts = { generatedAt: NOW, accepting: false }

function league(over: Record<string, unknown> = {}) {
  return {
    found: true as const,
    kind: 'league' as const,
    name: 'The Thursday League',
    season: 'Caledonian Premiership 2027/28',
    game: 'Match Predictor',
    alreadyIn: false,
    requiresGameEntry: false,
    joinWith: 'join_league' as const,
    ...over,
  }
}

function competition(over: Record<string, unknown> = {}) {
  return {
    found: true as const,
    kind: 'competition' as const,
    name: 'Office Championship',
    season: 'Caledonian Premiership 2027/28',
    game: 'Predictor Championship',
    gameKey: 'predictor_cup' as const,
    alreadyIn: false,
    isOwner: false,
    closed: false,
    joinWith: 'join_private_competition' as const,
    ...over,
  }
}

const ready = (invite: unknown): InviteState =>
  ({ status: 'ready', invite }) as InviteState

describe('a code that resolved to nothing says nothing', () => {
  it('carries no code, no reason and no suggestion', () => {
    const model = buildInviteModel({ status: 'notfound' }, opts)
    expect(model.panel).toEqual({ kind: 'not-found' })
    expect(Object.keys(model.panel)).toEqual(['kind'])
  })

  it('is not the same state as a lookup that failed', () => {
    const failed = buildInviteModel({ status: 'error', message: 'Network' }, opts)
    expect(failed.panel.kind).toBe('failed')
    expect(buildInviteModel({ status: 'notfound' }, opts).panel.kind).toBe('not-found')
  })

  it('treats idle and looking as one thing, because they are to a reader', () => {
    expect(buildInviteModel({ status: 'idle' }, opts).panel).toEqual({ kind: 'looking' })
    expect(buildInviteModel({ status: 'looking' }, opts).panel).toEqual({ kind: 'looking' })
  })
})

describe('no button is offered that the server would refuse', () => {
  it('offers accept for an open competition invite', () => {
    const model = buildInviteModel(ready(competition()), opts)
    expect(offersAccept(model.panel)).toBe(true)
  })

  it('refuses a closed competition rather than offering a join', () => {
    const model = buildInviteModel(ready(competition({ closed: true })), opts)
    expect(offersAccept(model.panel)).toBe(false)
    if (model.panel.kind !== 'invite') throw new Error('expected an invite')
    expect(model.panel.details.action).toEqual({ kind: 'closed' })
  })

  it('sends a league invite to the game first where entry is required', () => {
    const model = buildInviteModel(ready(league({ requiresGameEntry: true })), opts)
    expect(offersAccept(model.panel)).toBe(false)
    if (model.panel.kind !== 'invite') throw new Error('expected an invite')
    // The decoder carries this flag exactly so a surface can do this instead of
    // offering a button the database will refuse.
    expect(model.panel.details.action).toEqual({
      kind: 'needs-game-first',
      gameName: 'Match Predictor',
    })
  })

  it('carries a null game name rather than inventing one', () => {
    const model = buildInviteModel(ready(league({ requiresGameEntry: true, game: null })), opts)
    if (model.panel.kind !== 'invite') throw new Error('expected an invite')
    expect(model.panel.details.action).toEqual({ kind: 'needs-game-first', gameName: null })
  })

  it('says already-in rather than offering a join that does nothing', () => {
    for (const invite of [league({ alreadyIn: true }), competition({ alreadyIn: true })]) {
      const model = buildInviteModel(ready(invite), opts)
      expect(offersAccept(model.panel)).toBe(false)
      if (model.panel.kind !== 'invite') throw new Error('expected an invite')
      expect(model.panel.details.action).toEqual({ kind: 'already-in' })
    }
  })

  it('lets already-in outrank closed, because a member does not care', () => {
    const model = buildInviteModel(ready(competition({ alreadyIn: true, closed: true })), opts)
    if (model.panel.kind !== 'invite') throw new Error('expected an invite')
    expect(model.panel.details.action).toEqual({ kind: 'already-in' })
  })

  it('lets already-in outrank needing the game first', () => {
    const model = buildInviteModel(ready(league({ alreadyIn: true, requiresGameEntry: true })), opts)
    if (model.panel.kind !== 'invite') throw new Error('expected an invite')
    expect(model.panel.details.action).toEqual({ kind: 'already-in' })
  })

  it('names the owner as an owner, which is its own sentence', () => {
    const model = buildInviteModel(ready(competition({ isOwner: true })), opts)
    if (model.panel.kind !== 'invite') throw new Error('expected an invite')
    expect(model.panel.details.action).toEqual({ kind: 'owner' })
    expect(offersAccept(model.panel)).toBe(false)
  })
})

describe('the invite is carried as resolved', () => {
  it('keeps the container kind the server named', () => {
    expect(
      (buildInviteModel(ready(league()), opts).panel as { details: { container: string } }).details
        .container,
    ).toBe('league')
    expect(
      (buildInviteModel(ready(competition()), opts).panel as { details: { container: string } })
        .details.container,
    ).toBe('competition')
  })

  it('keeps a null season null', () => {
    const model = buildInviteModel(ready(league({ season: null })), opts)
    if (model.panel.kind !== 'invite') throw new Error('expected an invite')
    expect(model.panel.details.season).toBeNull()
  })

  it('carries the accepting flag through without deciding it', () => {
    expect(buildInviteModel(ready(league()), { ...opts, accepting: true }).accepting).toBe(true)
  })
})
