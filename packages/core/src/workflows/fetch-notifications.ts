import { ApplicationFailure, proxyActivities } from '@temporalio/workflow'
import type * as findAccountActivities from '../activities/find-account.js'
import type * as findNotificationActivities from '../activities/find-notification.js'
import type * as findNotificationsActivities from '../activities/find-notifications.js'
import type * as syncNotificationsActivities from '../activities/sync-notifications.js'

const { findAccountActivity: findAccount } = proxyActivities<typeof findAccountActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { syncNotificationsActivity: syncNotifications } = proxyActivities<typeof syncNotificationsActivities>({
  heartbeatTimeout: '30 seconds',
  startToCloseTimeout: '3 minutes',
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
  userId: string
}

export interface FetchNotificationsResult {
  notificationIds: string[]
}

export async function fetchNotificationsWorkflow(params: FetchNotificationsParams): Promise<FetchNotificationsResult> {
  const { domain, userId } = params
  const notificationIds = new Set<string>()

  const account = await findAccount({ where: { providerId: domain, accountId: userId }, select: { accessToken: true } })
  if (!account?.accessToken) throw ApplicationFailure.nonRetryable('Unauthorized', 'Unauthorized')

  // 저장된 알림 찾기
  const [latest, oldest] = await Promise.all([
    findNotification({
      where: { domain, userId },
      orderBy: { createdAt: 'desc' },
      select: { notificationId: true, createdAt: true },
    }),
    findNotification({
      where: { domain, userId },
      orderBy: { createdAt: 'asc' },
      select: { notificationId: true, createdAt: true },
    }),
  ])

  // 저장된 알림의 위치부터 이어서 데이터 동기화
  await syncNotifications({ domain, accessToken: account.accessToken, minId: latest?.notificationId })
  await syncNotifications({ domain, accessToken: account.accessToken, maxId: oldest?.notificationId })

  // 저장된 알림이 없었던 경우 동기화된 모든 알림을 목록에 추가
  if (!latest && !oldest) {
    for (const { notificationId } of await findNotifications({
      where: { domain, userId, reactions: { none: {} } },
      select: { notificationId: true },
    })) {
      notificationIds.add(notificationId)
    }
  } else {
    // 동기화된 새 알림들을 찾아서 목록에 추가
    if (latest) {
      for (const { notificationId } of await findNotifications({
        where: { domain, userId, reactions: { none: {} }, createdAt: { gt: latest.createdAt } },
        select: { notificationId: true },
      })) {
        notificationIds.add(notificationId)
      }
    }
    if (oldest) {
      for (const { notificationId } of await findNotifications({
        where: { domain, userId, reactions: { none: {} }, createdAt: { lt: oldest.createdAt } },
        select: { notificationId: true },
      })) {
        notificationIds.add(notificationId)
      }
    }
  }

  return { notificationIds: Array.from(notificationIds) }
}
