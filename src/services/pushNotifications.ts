import { db } from './supabase/client'

export type PushNotificationState =
  | { readonly kind: 'unconfigured' }
  | { readonly kind: 'unsupported' }
  | { readonly kind: 'ios-tab' }
  | { readonly kind: 'denied' }
  | { readonly kind: 'promptable' }
  | { readonly kind: 'subscribed' }

type StandaloneNavigator = Navigator & { readonly standalone?: boolean }

export function vapidPublicKeyBytes(key: string): Uint8Array<ArrayBuffer> {
  const normalized = key.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const decoded = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(decoded.length))
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index)
  return bytes
}

export function classifyPushNotificationState(input: {
  readonly configured: boolean
  readonly supported: boolean
  readonly iosTab: boolean
  readonly permission: NotificationPermission
  readonly subscribed: boolean
}): PushNotificationState {
  if (!input.configured) return { kind: 'unconfigured' }
  if (input.iosTab) return { kind: 'ios-tab' }
  if (!input.supported) return { kind: 'unsupported' }
  if (input.permission === 'denied') return { kind: 'denied' }
  return input.subscribed ? { kind: 'subscribed' } : { kind: 'promptable' }
}

function configuredKey(): string {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? ''
}

function browserSupportsPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function isIosBrowserTab(): boolean {
  if (typeof navigator === 'undefined') return false
  const iosDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iosDevice && (navigator as StandaloneNavigator).standalone !== true
}

async function pushManager(): Promise<PushManager> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const json = subscription.toJSON()
  const p256dh = json.keys?.p256dh
  const auth = json.keys?.auth
  if (!p256dh || !auth) throw new Error('The browser did not provide push encryption keys.')

  const { error } = await db.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
  })
  if (error) throw error
}

async function storedSubscriptionExists(endpoint: string): Promise<boolean> {
  const { data, error } = await db
    .from('push_subscriptions')
    .select('endpoint')
    .eq('endpoint', endpoint)
    .maybeSingle()
  if (error) throw error
  return data !== null
}

async function removeStoredSubscription(endpoint: string): Promise<void> {
  const { error } = await db.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

export async function getPushNotificationState(): Promise<PushNotificationState> {
  const key = configuredKey()
  const iosTab = isIosBrowserTab()
  const supported = browserSupportsPush()
  if (!key || iosTab || !supported || Notification.permission === 'denied') {
    return classifyPushNotificationState({
      configured: key.length > 0,
      supported,
      iosTab,
      permission: supported ? Notification.permission : 'default',
      subscribed: false,
    })
  }

  const subscription = await (await pushManager()).getSubscription()
  const subscribed =
    subscription === null ? false : await storedSubscriptionExists(subscription.endpoint)

  return classifyPushNotificationState({
    configured: true,
    supported: true,
    iosTab: false,
    permission: Notification.permission,
    subscribed,
  })
}

export async function setPushNotifications(on: boolean): Promise<void> {
  const manager = await pushManager()
  const existing = await manager.getSubscription()

  if (!on) {
    if (existing === null) return
    // The row is the opt-in. Remove the endpoint and encryption keys first so
    // even a browser that refuses to release its local object cannot be reached.
    await removeStoredSubscription(existing.endpoint)
    await existing.unsubscribe().catch(() => false)
    return
  }

  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission
  if (permission !== 'granted') throw new Error('The browser did not allow notifications.')

  const key = configuredKey()
  if (!key) throw new Error('Push notifications are not configured on this deployment.')

  const subscription =
    existing ??
    (await manager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKeyBytes(key),
    }))

  try {
    await saveSubscription(subscription)
  } catch (error) {
    await subscription.unsubscribe().catch(() => false)
    throw error
  }
}
