import { afterEach, describe, expect, it, vi } from 'vitest'

const { initMock, captureMock } = vi.hoisted(() => ({
  initMock: vi.fn(),
  captureMock: vi.fn(),
}))

vi.mock('posthog-js', () => ({
  default: {
    init: initMock,
    capture: captureMock,
  },
}))

import {
  captureProductEvent,
  initProductAnalytics,
} from '../../src/services/analytics/productAnalytics'

afterEach(() => {
  vi.unstubAllEnvs()
  initMock.mockClear()
  captureMock.mockClear()
})

describe('product analytics adapter', () => {
  it('stays off without a key and only starts after an explicit opt-in', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '')

    expect(await initProductAnalytics()).toBe(false)
    expect(initMock).not.toHaveBeenCalled()

    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://example.test')

    expect(await initProductAnalytics()).toBe(true)
    expect(initMock).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://example.test',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
      }),
    )

    expect(
      await captureProductEvent('prediction_saved', { source: 'test' }),
    ).toBe(true)
    expect(captureMock).toHaveBeenCalledWith('prediction_saved', {
      source: 'test',
    })
  })
})
