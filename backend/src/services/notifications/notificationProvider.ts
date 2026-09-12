import { env } from '../../config/env.js'
import { MetaWhatsAppProvider } from './metaWhatsAppProvider.js'
import {
  MockNotificationProvider,
  mockNotificationProvider,
} from './mockNotificationProvider.js'
import type { NotificationProvider } from './types.js'

/**
 * Provider factory for notification dispatching.
 *
 * Rules:
 * - If MESSAGING_PROVIDER='mock' (default): returns the deterministic MockNotificationProvider.
 * - If MESSAGING_PROVIDER='meta': validates production credentials. If any required credential
 *   is missing, throws an explicit configuration error (never silently falls back to mock).
 */
export function getNotificationProvider(overrideType?: 'mock' | 'meta'): NotificationProvider {
  // In test environments, default to mock unless explicitly requested otherwise
  const isTestEnv = process.env.NODE_ENV === 'test'
  const defaultProvider = isTestEnv ? 'mock' : env.messagingProvider
  const providerType = overrideType ?? defaultProvider

  if (providerType === 'meta') {
    const metaProvider = new MetaWhatsAppProvider()
    const check = metaProvider.validateConfiguration()
    if (!check.valid) {
      throw new Error(
        `[NotificationProvider] MESSAGING_PROVIDER is set to "meta", but configuration is incomplete: ${check.error}`,
      )
    }
    return metaProvider
  }

  if (providerType === 'mock') {
    return mockNotificationProvider
  }

  throw new Error(
    `[NotificationProvider] Unsupported MESSAGING_PROVIDER: "${providerType}". Must be "mock" or "meta".`,
  )
}

export { MockNotificationProvider, MetaWhatsAppProvider }
