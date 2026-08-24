import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, maybeSingle, eq, select, remove, from } = vi.hoisted(() => {
  const rpc = vi.fn()
  const maybeSingle = vi.fn()
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const remove = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select, delete: remove }))
  return { rpc, maybeSingle, eq, select, remove, from }
})

vi.mock('../../src/services/supabase/client', () => ({ db: { rpc, from } }))

import {
  classifyPushNotificationState,
  getPushNotificationState,
  setPushNotifications,
  vapidPublicKeyBytes,
} from '../../src/services/pushNotifications'

const PUBLIC_KEY = `B${'A'.repeat(86)}`

function subscription(overrides: Partial<PushSubscription> = {}): PushSubscription {
  return {
    endpoint: 'https://push.example.com/one',
    expirationTime: null,
    options: {} as PushSubscriptionOptions,
    getKey: vi.fn(),
    toJSON: () => ({
      endpoint: 'https://push.example.com/one',
      keys: { p256dh: 'p256dh', auth: 'auth' },
    }),
    unsubscribe: vi.fn(async () => true),
    ...overrides,
  }
}

function installBrowser(current: PushSubscription | null) {
  const manager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => subscription()),
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: manager }) },
  })
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} })
  Object.defineProperty(window, 'Notification', {
    configurable: true,
    value: { permission: 'default', requestPermission: vi.fn(async () => 'granted') },
  })
  return manager
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', PUBLIC_KEY)
  rpc.mockResolvedValue({ error: null })
  maybeSingle.mockResolvedValue({ data: null, error: null })
  eq.mockImplementation(() => ({ maybeSingle }))
})

describe('pushNotifications', () => {
  it('converts an unpadded base64url VAPID key', () => {
    expect([...vapidPublicKeyBytes('_-4')]).toEqual([255, 238])
  })

  it.each([
    [{ configured: false, supported: true, iosTab: false, permission: 'default', subscribed: false }, 'unconfigured'],
    [{ configured: true, supported: false, iosTab: false, permission: 'default', subscribed: false }, 'unsupported'],
    [{ configured: true, supported: false, iosTab: true, permission: 'default', subscribed: false }, 'ios-tab'],
    [{ configured: true, supported: true, iosTab: false, permission: 'denied', subscribed: false }, 'denied'],
    [{ configured: true, supported: true, iosTab: false, permission: 'default', subscribed: false }, 'promptable'],
    [{ configured: true, supported: true, iosTab: false, permission: 'granted', subscribed: true }, 'subscribed'],
  ] as const)('maps browser capability to $kind', (input, kind) => {
    expect(classifyPushNotificationState(input).kind).toBe(kind)
  })

  it('treats the stored own-row, not a browser object by itself, as the opt-in', async () => {
    installBrowser(subscription())
    Object.defineProperty(window.Notification, 'permission', { value: 'granted' })

    await expect(getPushNotificationState()).resolves.toEqual({ kind: 'promptable' })
    expect(select).toHaveBeenCalledWith('endpoint')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('reports subscribed only when this browser endpoint has an own row', async () => {
    installBrowser(subscription())
    Object.defineProperty(window.Notification, 'permission', { value: 'granted' })
    maybeSingle.mockResolvedValue({ data: { endpoint: 'https://push.example.com/one' }, error: null })

    await expect(getPushNotificationState()).resolves.toEqual({ kind: 'subscribed' })
  })

  it('surfaces an inability to check the subscription row', async () => {
    installBrowser(subscription())
    Object.defineProperty(window.Notification, 'permission', { value: 'granted' })
    maybeSingle.mockResolvedValue({ data: null, error: new Error('read failed') })

    await expect(getPushNotificationState()).rejects.toThrow('read failed')
  })

  it('subscribes and stores the endpoint and keys after permission is granted', async () => {
    const manager = installBrowser(null)
    await setPushNotifications(true)
    expect(manager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }))
    expect(rpc).toHaveBeenCalledWith('save_push_subscription', {
      p_endpoint: 'https://push.example.com/one',
      p_p256dh: 'p256dh',
      p_auth: 'auth',
    })
  })

  it('unsubscribes again when storing a new opt-in fails', async () => {
    const created = subscription()
    const manager = installBrowser(null)
    manager.subscribe.mockResolvedValue(created)
    rpc.mockResolvedValue({ error: new Error('save failed') })
    await expect(setPushNotifications(true)).rejects.toThrow('save failed')
    expect(created.unsubscribe).toHaveBeenCalledOnce()
  })

  it('deletes the stored endpoint and keys before releasing the browser subscription', async () => {
    const existing = subscription()
    installBrowser(existing)
    eq.mockResolvedValue({ error: null } as never)

    await setPushNotifications(false)

    expect(from).toHaveBeenCalledWith('push_subscriptions')
    expect(remove).toHaveBeenCalledWith()
    expect(eq).toHaveBeenCalledWith('endpoint', existing.endpoint)
    expect(eq.mock.invocationCallOrder.at(-1)).toBeLessThan(
      vi.mocked(existing.unsubscribe).mock.invocationCallOrder[0] as number,
    )
  })

  it('does not release the browser subscription when deleting its opt-in fails', async () => {
    const existing = subscription()
    installBrowser(existing)
    eq.mockResolvedValue({ error: new Error('delete failed') } as never)

    await expect(setPushNotifications(false)).rejects.toThrow('delete failed')
    expect(existing.unsubscribe).not.toHaveBeenCalled()
  })
})
