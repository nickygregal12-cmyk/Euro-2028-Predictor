import type { AccountPushNotifications } from '../../account/VNextAccount'

export const accountPushNotificationStates = {
  unconfigured: { kind: 'unconfigured' },
  unsupported: { kind: 'unsupported' },
  iosTab: { kind: 'ios-tab' },
  denied: { kind: 'denied' },
  promptable: { kind: 'promptable' },
  subscribed: { kind: 'subscribed' },
  unavailable: { kind: 'unavailable' },
} as const satisfies Readonly<Record<string, AccountPushNotifications>>

export type AccountPushNotificationScenario = keyof typeof accountPushNotificationStates
