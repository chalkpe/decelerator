import { heartbeat, log, sleep } from '@temporalio/activity'
import { createRestAPIClient, MastoHttpError } from 'masto'
import type { Notification } from 'masto/mastodon/entities/v1/notification.js'

export interface ListNotificationsParams {
  domain: string
  accessToken: string
  pagination?: { maxId?: string }
}

export interface ListNotificationsResult {
  notifications: Notification[]
  rateLimitExceeded: boolean
}

export async function listNotificationsActivity(params: ListNotificationsParams): Promise<ListNotificationsResult> {
  const notifications: Notification[] = []
  const { domain, accessToken, pagination } = params
  log.info('Fetching notifications', { domain, pagination })

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const paginator = masto.v1.notifications.list({ ...pagination, types: ['reblog'], limit: 40 })

  try {
    for await (const list of paginator) {
      log.info('Fetched notifications', { domain, count: list.length })
      notifications.push(...list)

      if (notifications.length >= 10) {
        break
      }

      await sleep(1000)
      heartbeat()
    }
  } catch (error) {
    if (error instanceof MastoHttpError && error.statusCode === 429) {
      log.warn('Rate limit exceeded', { domain })
      return { notifications, rateLimitExceeded: true }
    }
    throw error
  }

  log.info('Finished fetching notifications', { domain, count: notifications.length })
  return { notifications, rateLimitExceeded: false }
}
