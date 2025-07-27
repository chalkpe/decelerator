import { proxyActivities } from '@temporalio/workflow'
import type * as findNotificationActivities from '../activities/find-notification'
import type * as findNotificationsActivities from '../activities/find-notifications'
import type * as syncNotificationsActivities from '../activities/sync-notifications'

const { syncNotificationsActivity: syncNotifications } = proxyActivities<typeof syncNotificationsActivities>({
  heartbeatTimeout: '30 seconds',
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '5 minutes',
    nonRetryableErrorTypes: ['MastoHttpError', 'PrismaClientKnownRequestError'],
  },
})
const { findNotificationsActivity: findNotifications } = proxyActivities<typeof findNotificationsActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { findNotificationActivity: findNotification } = proxyActivities<typeof findNotificationActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

export interface FetchNotificationsParams {
  domain: string
  accessToken: string
  userId: string
}

export interface FetchNotificationsResult {
  notificationIds: string[]
}

export async function fetchNotificationsWorkflow(params: FetchNotificationsParams): Promise<FetchNotificationsResult> {
  const { domain, accessToken, userId } = params
  const notificationIds = new Set<string>()

  // 마지막 알림 이후 데이터 동기화
  const latest = await findNotification({
    where: { domain, userId },
    orderBy: { createdAt: 'desc' },
    select: { notificationId: true, createdAt: true },
  })
  await syncNotifications({ domain, accessToken, minId: latest?.notificationId })

  // 첫 알림 이전 데이터 동기화
  const oldest = await findNotification({
    where: { domain, userId },
    orderBy: { createdAt: 'asc' },
    select: { notificationId: true, createdAt: true },
  })
  await syncNotifications({ domain, accessToken, maxId: oldest?.notificationId })

  // 동기화된 새 알림들을 찾아서 목록에 추가
  if (latest) {
    for (const { notificationId } of await findNotifications({
      where: { domain, userId, reactionId: null, createdAt: { gt: latest.createdAt } },
      orderBy: { createdAt: 'asc' },
      select: { notificationId: true },
    })) {
      notificationIds.add(notificationId)
    }
  }
  if (oldest) {
    for (const { notificationId } of await findNotifications({
      where: { domain, userId, reactionId: null, createdAt: { lt: oldest.createdAt } },
      orderBy: { createdAt: 'desc' },
      select: { notificationId: true },
    })) {
      notificationIds.add(notificationId)
    }
  }

  return { notificationIds: Array.from(notificationIds) }
}
