import { prisma, type ServerSoftware } from '@decelerator/database'
import { sleep } from '@temporalio/activity'
import { createRestAPIClient } from 'masto'
import { api } from 'misskey-js'

export interface SyncNotificationsParams {
  domain: string
  software: ServerSoftware
  accessToken: string
  minId?: string
  maxId?: string
}

export interface SyncNotificationsResult {
  count: number
}

export async function syncNotificationsActivity(params: SyncNotificationsParams): Promise<SyncNotificationsResult> {
  const { domain, software, accessToken, minId, maxId } = params

  switch (software) {
    case 'MASTODON': {
      const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
      const notifications = await masto.v1.notifications.list({ types: ['reblog'], minId, maxId })
      const reblogNotifications = notifications.flatMap((n) => (n.type === 'reblog' ? [n] : []))

      const { count } = await prisma.reblogNotification.createMany({
        skipDuplicates: true,
        data: reblogNotifications.map((notification) => ({
          domain,
          notificationId: notification.id,
          createdAt: new Date(notification.createdAt),
          userId: notification.status.account.id,
          statusId: notification.status.id,
          accountId: notification.account.id,
        })),
      })

      await sleep('3 seconds')
      return { count }
    }

    case 'MISSKEY': {
      const client = new api.APIClient({ origin: `https://${domain}`, credential: accessToken })
      const notifications = await client.request('i/notifications', {
        includeTypes: ['renote'],
        markAsRead: false,
        sinceId: minId,
        untilId: maxId,
        limit: 100,
      })

      const { count } = await prisma.reblogNotification.createMany({
        skipDuplicates: true,
        data: notifications.flatMap((notification) =>
          notification.type === 'renote' && notification.note.renote
            ? [
                {
                  domain,
                  notificationId: notification.id,
                  createdAt: new Date(notification.createdAt),
                  userId: notification.note.renote.userId,
                  statusId: notification.note.renote.id,
                  accountId: notification.userId,
                },
              ]
            : [],
        ),
      })

      await sleep('3 seconds')
      return { count }
    }
  }
}
