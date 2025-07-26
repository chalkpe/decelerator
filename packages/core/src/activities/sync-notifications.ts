import { prisma } from '@decelerator/database'
import { heartbeat, log, sleep } from '@temporalio/activity'
import { createRestAPIClient, MastoHttpError } from 'masto'
import ms from 'ms'

export interface SyncNotificationsParams {
  domain: string
  accessToken: string
  limit?: ms.StringValue
}

export interface SyncNotificationsResult {
  rateLimitExceeded: boolean
}

export async function syncNotificationsActivity(params: SyncNotificationsParams): Promise<SyncNotificationsResult> {
  const { domain, accessToken, limit = '30 days' } = params
  log.info('Fetching notifications', { domain, limit })

  const past = Date.now() - ms(limit)
  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const paginator = masto.v1.notifications.list({ types: ['reblog'] })

  try {
    for await (const notifications of paginator) {
      log.info('Fetched notifications', { count: notifications.length })

      const data = notifications.flatMap((notification) =>
        notification.type === 'reblog'
          ? [
              {
                domain,
                notificationId: notification.id,
                createdAt: new Date(notification.createdAt),
                userId: notification.status.account.id,
                statusId: notification.status.id,
                accountId: notification.account.id,
                reactionId: null,
                data: notification,
              },
            ]
          : [],
      )

      const { count } = await prisma.reblogNotification.createMany({ data, skipDuplicates: true })
      if (count < data.length) {
        log.info('Existing data found, stopping fetch', { count })
        break
      }

      if (notifications.some((n) => new Date(n.createdAt).getTime() < past)) {
        log.info('Reached past limit, stopping fetch', { past })
        break
      }

      heartbeat()
      await sleep(1000)
    }
  } catch (error) {
    if (error instanceof MastoHttpError && error.statusCode === 429) {
      log.warn('Rate limit exceeded', { domain })
      return { rateLimitExceeded: true }
    }
    throw error
  }
  return { rateLimitExceeded: false }
}
