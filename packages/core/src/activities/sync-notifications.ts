import { prisma } from '@decelerator/database'
import { sleep } from '@temporalio/activity'
import { createRestAPIClient } from 'masto'

export interface SyncNotificationsParams {
  domain: string
  accessToken: string
  minId?: string
  maxId?: string
}

export async function syncNotificationsActivity(params: SyncNotificationsParams) {
  const { domain, accessToken, minId, maxId } = params

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const notifications = await masto.v1.notifications.list({ types: ['reblog'], minId, maxId })

  const result = await prisma.reblogNotification.createMany({
    skipDuplicates: true,
    data: notifications.flatMap((notification) =>
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
    ),
  })

  await sleep('3 seconds')
  return result
}
