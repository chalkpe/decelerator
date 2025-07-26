import { prisma } from '@decelerator/database'
import { heartbeat, sleep } from '@temporalio/activity'
import { createRestAPIClient, MastoHttpError } from 'masto'
import ms from 'ms'

export interface SyncNotificationsParams {
  domain: string
  accessToken: string
  minId?: string
  maxId?: string
  limit?: ms.StringValue
}

export interface SyncNotificationsResult {
  rateLimitExceeded: boolean
}

export async function syncNotificationsActivity(params: SyncNotificationsParams): Promise<SyncNotificationsResult> {
  const { domain, accessToken, minId, maxId, limit = '10 years' } = params

  try {
    const past = new Date(Date.now() - ms(limit))
    const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
    const paginator = masto.v1.notifications.list({ types: ['reblog'], minId, maxId })

    for await (const notifications of paginator) {
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
      if (count < data.length) break
      if (data.some((n) => n.createdAt < past)) break

      heartbeat()
      await sleep(1000)
    }
  } catch (error) {
    if (error instanceof MastoHttpError && error.statusCode === 429) return { rateLimitExceeded: true }
    throw error
  }
  return { rateLimitExceeded: false }
}
