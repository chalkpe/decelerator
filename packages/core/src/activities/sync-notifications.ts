import { prisma } from '@decelerator/database'
import { log, sleep } from '@temporalio/activity'
import { createRestAPIClient } from 'masto'

export interface SyncNotificationsParams {
  domain: string
  accessToken: string
  minId?: string
  maxId?: string
}

export interface SyncNotificationsResult {
  count: number
}

export async function syncNotificationsActivity(params: SyncNotificationsParams): Promise<SyncNotificationsResult> {
  const { domain, accessToken, minId, maxId } = params

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  const notifications = await masto.v1.notifications.list({ types: ['reblog'], minId, maxId })
  const reblogNotifications = notifications.flatMap((n) => (n.type === 'reblog' ? [n] : []))

  log.info(
    'hllll',
    reblogNotifications.map((notification) => ({
      notificationId: notification.id,
      statusId: notification.status.id,
    })),
  )

  const { count } = await prisma.reblogNotification.createMany({
    skipDuplicates: true,
    data: reblogNotifications.map((notification) => ({
      domain,
      notificationId: notification.id,
      createdAt: new Date(notification.createdAt),
      userId: notification.status.account.id,
      statusId: notification.status.id,
      accountId: notification.account.id,
      data: notification,
    })),
  })

  await sleep('3 seconds')
  return { count }
}
