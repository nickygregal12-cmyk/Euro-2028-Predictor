import { describe, expect, it, vi } from 'vitest'
import { createSaveController } from '../../src/app/providers/saveController'

describe('save controller lifecycle', () => {
  it('becomes usable again after a dispose followed by an entry reset', async () => {
    const performSave = vi.fn(async () => undefined)
    const onStatus = vi.fn()
    const controller = createSaveController({ performSave, onStatus })

    // Mirrors React Strict Mode's development effect preflight: cleanup disposes
    // the retained controller, then the authenticated-entry effect starts fresh.
    controller.dispose()
    controller.reset()
    controller.change('m:test', { homeScore: 2, awayScore: 1 })

    await expect(controller.waitForSettled()).resolves.toEqual({
      ok: true,
      cancelled: false,
      errorKeys: [],
      conflictKeys: [],
    })
    expect(performSave).toHaveBeenCalledTimes(1)
    expect(performSave).toHaveBeenCalledWith('m:test', {
      homeScore: 2,
      awayScore: 1,
    })
    expect(onStatus).toHaveBeenCalledWith('m:test', 'saving')
    expect(onStatus).toHaveBeenCalledWith('m:test', 'saved')
  })

  it('continues to ignore changes after a terminal dispose without reset', async () => {
    const performSave = vi.fn(async () => undefined)
    const controller = createSaveController({ performSave, onStatus: vi.fn() })

    controller.dispose()
    controller.change('m:test', { homeScore: 1, awayScore: 0 })
    await Promise.resolve()

    expect(performSave).not.toHaveBeenCalled()
    await expect(controller.waitForSettled()).resolves.toMatchObject({
      ok: false,
      cancelled: true,
    })
  })
})
