import { continueAsNew, executeChild, proxyActivities, sleep, workflowInfo } from '@temporalio/workflow'
import ms from 'ms'
import type * as findAccountsActivities from '../activities/find-accounts.js'
import type * as findNotificationsActivities from '../activities/find-notifications.js'
import { maxReactionDelay } from '../constants.js'
import type { fetchNotificationsWorkflow } from './fetch-notifications.js'
import type { fetchReactionWorkflow } from './fetch-reaction.js'

const { findAccountsActivity: findAccounts } = proxyActivities<typeof findAccountsActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})
const { findNotificationsActivity: findNotifications } = proxyActivities<typeof findNotificationsActivities>({
  startToCloseTimeout: '15 seconds',
  retry: { nonRetryableErrorTypes: ['PrismaClientKnownRequestError'] },
})

export interface DaemonWorkflowInput {
  domain: string
}

export async function daemonWorkflow({ domain }: DaemonWorkflowInput) {
  while (!workflowInfo().continueAsNewSuggested) {
    const queue = new Set<string>()

    // 모든 계정의 신규 알림들을 가져와서 큐에 추가
    for (const { accountId: userId } of await findAccounts({ where: { providerId: domain } })) {
      const { notificationIds } = await executeChild<typeof fetchNotificationsWorkflow>('fetchNotificationsWorkflow', {
        workflowId: `fetch-notifications-${domain}-${userId}`,
        args: [{ domain, userId }],
      })
      for (const notificationId of notificationIds) queue.add(notificationId)
    }

    // 모든 계정의 기존 알림 중 아직 미확정 상태의 알림들을 찾아서 큐에 추가
    for (const { notificationId } of await findNotifications({
      where: { domain, reactionId: null, createdAt: { gt: new Date(Date.now() - ms(maxReactionDelay)) } },
      select: { notificationId: true },
    })) {
      queue.add(notificationId)
    }

    // 큐의 모든 알림들의 반응을 가져오기
    const sortedQueue = Array.from(queue).toSorted((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    for (const notificationId of sortedQueue) {
      try {
        await executeChild<typeof fetchReactionWorkflow>('fetchReactionWorkflow', {
          workflowId: `fetch-reaction-${domain}-${notificationId}`,
          args: [{ domain, notificationId }],
        })
      } catch (_) {
        // 반응이 없는 알림은 무시
      }
    }

    await sleep('1 minute')
  }
  return await continueAsNew({ domain })
}
