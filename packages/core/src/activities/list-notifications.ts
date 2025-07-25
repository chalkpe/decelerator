import type { ReblogNotificationCreateManyInput } from '@decelerator/database'
import { heartbeat, log, sleep } from '@temporalio/activity'
import { createRestAPIClient, MastoHttpError } from 'masto'
import ms from 'ms'

export interface ListNotificationsParams {
  domain: string
  accessToken: string
  pagination?: { minId?: string; maxId?: string }
  limit?: ms.StringValue
}

export interface ListNotificationsResult {
  notifications: ReblogNotificationCreateManyInput[]
  rateLimitExceeded: boolean
}

export async function listNotificationsActivity(params: ListNotificationsParams): Promise<ListNotificationsResult> {
  const { domain, accessToken, pagination, limit = '30 days' } = params
  log.info('Fetching notifications', { domain, pagination, limit })

  const past = Date.now() - ms(limit)
  const notifications: ListNotificationsResult['notifications'] = []

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const paginator = masto.v1.notifications.list({ ...pagination, types: ['reblog'] })

  try {
    for await (const list of paginator) {
      log.info('Fetched notifications', { count: list.length })
      notifications.push(
        ...list.flatMap((notification) =>
          notification.status
            ? [
                {
                  domain,
                  notificationId: notification.id,
                  createdAt: new Date(notification.createdAt),
                  userId: notification.status.account.id,
                  statusId: notification.status.id,
                  accountId: notification.account.id,
                  reactionId: null,
                },
              ]
            : [],
        ),
      )

      if (notifications.some((n) => new Date(n.createdAt).getTime() < past)) {
        log.info('Reached past limit, stopping fetching notifications', { past })
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

  log.info('Finished fetching notifications', { count: notifications.length })
  return { notifications, rateLimitExceeded: false }
}
