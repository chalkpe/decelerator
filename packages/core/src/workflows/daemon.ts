import { continueAsNew, proxyActivities, sleep, workflowInfo } from '@temporalio/workflow'
import type * as findAccountsActivities from '../activities/find-accounts'
import type * as findIndexActivities from '../activities/find-index'
import type * as findNotificationActivities from '../activities/find-notification'
import type * as findNotificationsActivities from '../activities/find-notifications'
import type * as syncIndexActivities from '../activities/sync-index'
import type * as syncNotificationsActivities from '../activities/sync-notifications'
import type * as updateNotificationActivities from '../activities/update-notification'

const { syncIndexActivity: syncIndex } = proxyActivities<typeof syncIndexActivities>({
  heartbeatTimeout: '30 seconds',
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '5 minutes',
    nonRetryableErrorTypes: ['MastoHttpError', 'PrismaClientKnownRequestError'],
  },
})
const { updateNotificationActivity: updateNotification } = proxyActivities<typeof updateNotificationActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { findIndexActivity: findIndex } = proxyActivities<typeof findIndexActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { syncNotificationsActivity: syncNotifications } = proxyActivities<typeof syncNotificationsActivities>({
  heartbeatTimeout: '30 seconds',
  startToCloseTimeout: '30 minutes',
  retry: {
    initialInterval: '5 minutes',
    nonRetryableErrorTypes: ['MastoHttpError', 'PrismaClientKnownRequestError'],
  },
})
const { findAccountsActivity: findAccounts } = proxyActivities<typeof findAccountsActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

const { findNotificationsActivity: findNotifications } = proxyActivities<typeof findNotificationsActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { findNotificationActivity: findNotification } = proxyActivities<typeof findNotificationActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

export interface DaemonWorkflowInput {
  domain: string
}

export async function daemonWorkflow({ domain }: DaemonWorkflowInput) {
  while (!workflowInfo().continueAsNewSuggested) {
    const accounts = await findAccounts({ where: { providerId: domain } })

    // 모든 계정의 알림을 동기화
    for (const { user, accessToken } of accounts) {
      if (!accessToken) continue

      const latest = await findNotification({ where: { domain, userId: user.mastodonId }, orderBy: { notificationId: 'desc' } })
      await syncNotifications({ domain, accessToken, minId: latest?.notificationId })

      const oldest = await findNotification({ where: { domain, userId: user.mastodonId }, orderBy: { notificationId: 'asc' } })
      await syncNotifications({ domain, accessToken, maxId: oldest?.notificationId })
    }

    // 아직 반응을 찾지 못한 모든 계정의 알림들을 순회
    for (const notification of await findNotifications({
      where: { domain, reactionId: null },
      orderBy: { notificationId: 'desc' },
      select: { userId: true, accountId: true, notificationId: true, statusId: true, createdAt: true },
    })) {
      const accessToken = accounts.find((account) => account.user.mastodonId === notification.userId)?.accessToken
      if (!accessToken) continue

      const existing = await findIndex({ where: { domain, accountId: notification.accountId, createdAt: { gt: notification.createdAt } } })
      if (existing) continue

      // 인덱스 동기화
      await syncIndex({ domain, accessToken, accountId: notification.accountId, minId: notification.statusId })

      // 반응 인덱스 찾기
      const reaction = await findIndex({
        where: { domain, accountId: notification.accountId, createdAt: { gt: notification.createdAt }, reblogId: null },
        orderBy: { createdAt: 'asc' },
      })

      if (reaction) {
        // 반응 인덱스가 생겼다면 업데이트
        await updateNotification({
          where: { domain_notificationId: { domain, notificationId: notification.notificationId } },
          data: { reactionId: reaction.statusId },
        })
      }
    }

    await sleep('1 minute')
  }
  return await continueAsNew({ domain })
}
